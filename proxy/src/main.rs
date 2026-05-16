use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::{
    body::Body,
    extract::{ConnectInfo, State},
    http::{Request, Response, StatusCode, Uri},
    middleware::{self, Next},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use bytes::Bytes;
use dashmap::DashMap;
use http_body_util::BodyExt;
use hyper_util::client::legacy::{connect::HttpConnector, Client};
use hyper_util::rt::TokioExecutor;
use serde_json::json;
use tower::ServiceBuilder;
use tower_http::{timeout::TimeoutLayer, trace::TraceLayer};
use tracing::{error, info};
use uuid::Uuid;

type HyperClient = Client<HttpConnector, Body>;

#[derive(Clone)]
struct RateLimitEntry {
    count: u32,
    window_start: Instant,
}

#[derive(Clone)]
struct AppState {
    client: HyperClient,
    rate_limiter: Arc<DashMap<String, RateLimitEntry>>,
    api_upstream: String,
    static_upstream: String,
}

async fn health_handler() -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "service": "swiftsend-proxy"
    }))
}

async fn rate_limit_middleware(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    req: Request<Body>,
    next: Next,
) -> Response<Body> {
    let ip = addr.ip().to_string();
    let is_auth_endpoint = req.uri().path().starts_with("/api/v1/auth");
    let limit = if is_auth_endpoint { 20u32 } else { 100u32 };

    let allow = {
        let mut entry = state
            .rate_limiter
            .entry(ip.clone())
            .or_insert(RateLimitEntry {
                count: 0,
                window_start: Instant::now(),
            });

        if entry.window_start.elapsed() > Duration::from_secs(60) {
            entry.count = 0;
            entry.window_start = Instant::now();
        }

        if entry.count < limit {
            entry.count += 1;
            true
        } else {
            false
        }
    };

    if !allow {
        let body = serde_json::to_string(&json!({
            "detail": "Rate limit exceeded",
            "code": "rate_limit_exceeded"
        }))
        .unwrap_or_default();

        return Response::builder()
            .status(StatusCode::TOO_MANY_REQUESTS)
            .header("Content-Type", "application/json")
            .header("Retry-After", "60")
            .header("X-RateLimit-Limit", limit.to_string())
            .body(Body::from(body))
            .unwrap();
    }

    next.run(req).await
}

async fn proxy_handler(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    req: Request<Body>,
) -> Response<Body> {
    let path = req.uri().path_and_query().map(|pq| pq.as_str()).unwrap_or("/");
    let upstream = if path.starts_with("/api/") {
        &state.api_upstream
    } else {
        &state.static_upstream
    };

    let target_uri = format!("{}{}", upstream, path);

    let uri: Uri = match target_uri.parse() {
        Ok(u) => u,
        Err(e) => {
            error!("Invalid upstream URI {}: {}", target_uri, e);
            return bad_gateway();
        }
    };

    let request_id = Uuid::new_v4().to_string();
    let client_ip = addr.ip().to_string();

    let (mut parts, body) = req.into_parts();
    parts.uri = uri;
    parts.headers.remove("host");
    parts
        .headers
        .insert("x-request-id", request_id.parse().unwrap());
    parts
        .headers
        .insert("x-forwarded-for", client_ip.parse().unwrap());

    let proxy_req = Request::from_parts(parts, body);

    match state.client.request(proxy_req).await {
        Ok(resp) => {
            let (parts, body) = resp.into_parts();
            let bytes = match body.collect().await {
                Ok(b) => b.to_bytes(),
                Err(e) => {
                    error!("Failed to read upstream body: {}", e);
                    return bad_gateway();
                }
            };
            Response::from_parts(parts, Body::from(bytes))
        }
        Err(e) => {
            error!("Upstream request failed: {}", e);
            bad_gateway()
        }
    }
}

fn bad_gateway() -> Response<Body> {
    let body = serde_json::to_string(&json!({
        "detail": "Upstream service unavailable",
        "code": "bad_gateway"
    }))
    .unwrap_or_default();

    Response::builder()
        .status(StatusCode::BAD_GATEWAY)
        .header("Content-Type", "application/json")
        .body(Body::from(body))
        .unwrap()
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("RUST_LOG")
                .unwrap_or_else(|_| "info".to_string())
                .as_str(),
        )
        .init();

    let api_upstream = std::env::var("API_UPSTREAM").unwrap_or_else(|_| "http://backend:8000".to_string());
    let static_upstream =
        std::env::var("STATIC_UPSTREAM").unwrap_or_else(|_| "http://frontend:80".to_string());

    let client = Client::builder(TokioExecutor::new()).build_http::<Body>();

    let state = AppState {
        client,
        rate_limiter: Arc::new(DashMap::new()),
        api_upstream,
        static_upstream,
    };

    let app = Router::new()
        .route("/health", get(health_handler))
        .fallback(proxy_handler)
        .layer(middleware::from_fn_with_state(
            state.clone(),
            rate_limit_middleware,
        ))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(TimeoutLayer::new(Duration::from_secs(30))),
        )
        .with_state(state);

    let bind_addr = "0.0.0.0:80";
    info!("SwiftSend proxy listening on {}", bind_addr);

    let listener = tokio::net::TcpListener::bind(bind_addr).await.unwrap();
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}
