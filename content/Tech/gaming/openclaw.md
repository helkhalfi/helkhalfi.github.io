Title: OpenClaw - Reviving a Classic 90s Platformer with Modern C++
Date: 2026-02-02
Status: published
Tags: openclaw, c++, sdl2, box2d, gaming, open-source, cmake, emscripten, webassembly
Author: Hichame El Khalfi


Remember Captain Claw ? The 1997 side-scrolling platformer by Monolith Productions where you play as an
anthropomorphic pirate cat on a quest for an ancient amulet ?

[OpenClaw](https://github.com/pjasicek/OpenClaw) is a full reimplementation of that game, written from
scratch in C++. The entire codebase is original, while it reuses the art and sound assets from the original
game archive (`CLAW.REZ`).

What makes this project interesting from an engineering perspective is the combination of libraries and the
cross-platform reach it achieves with a relatively lean codebase.

# Tech Stack

OpenClaw relies on a focused set of well-known libraries:

- **SDL2** (SDL2, SDL_Image, SDL_TTF, SDL_Mixer, SDL2_Gfx) - handles graphics rendering, input, fonts, and audio
- **Box2D** - physics engine for in-game mechanics (collisions, gravity, movement)
- **TinyXML** - enables a data-driven approach where game levels and configuration are defined in XML

This is a solid and portable combination. SDL2 abstracts away platform differences, Box2D is battle-tested
in countless 2D games, and TinyXML keeps the game logic decoupled from hard-coded values.

# Building from Source

## Prerequisites

You will need the original `CLAW.REZ` asset archive from the 1997 game placed in the `Build_Release` directory.

## On Linux (Ubuntu/Debian)

Install the SDL2 development packages:

```bash
sudo apt install libsdl2-dev libsdl2-image-dev libsdl2-mixer-dev libsdl2-ttf-dev libsdl2-gfx-dev
```

Then build with CMake:

```bash
git clone https://github.com/pjasicek/OpenClaw.git
cd OpenClaw
mkdir build && cd build
cmake ..
make -j$(nproc)
```

## On Windows

The project ships with a VS2017 solution that has all library paths preconfigured. Open `OpenClaw.sln` and
build. CMake is also supported if you prefer a different IDE.

## On macOS

```bash
brew install sdl2 sdl2_image sdl2_mixer sdl2_ttf sdl2_gfx
```

Then follow the same CMake steps as Linux.

# Running in the Browser with WebAssembly

One of the more impressive features is the Emscripten build target. You can compile OpenClaw to WebAssembly
and run it directly in a browser.

```bash
# Build with Emscripten
emcmake cmake ..
emmake make
```

Then serve the output with any HTTP server:

```bash
python3 -m http.server 8080
```

There is a live demo available at [claw.fernandoruizrico.com](https://claw.fernandoruizrico.com/) if you
want to try it without building anything.

# Platform Support

OpenClaw runs on an impressive number of platforms:

1. **Windows** - VS2017 solution or CMake
2. **Linux** - CMake (also available as RPM packages, and in FreeBSD ports as `games/openclaw`)
3. **macOS** - CMake
4. **Android** - dedicated build target
5. **Web browsers** - via Emscripten/WebAssembly
6. **Haiku OS** - available through HaikuPorts

# Why This Project is Worth a Look

Even if you have zero nostalgia for Captain Claw, OpenClaw is a well-structured example of:

- A **data-driven game architecture** using XML for level design and configuration
- Practical use of **Box2D** for 2D platformer physics
- **Cross-platform C++** targeting desktop, mobile, and web from a single codebase
- A **CMake build system** that handles multiple platforms and toolchains

The repository has 573+ commits and integrates CI via AppVeyor and Travis CI, plus static
analysis through Coverity. It is a solid reference for anyone building a 2D game engine or
learning how to structure a cross-platform C++ project.
