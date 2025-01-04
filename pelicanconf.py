from datetime import datetime

AUTHOR = 'Hichame El Khalfi'
SITENAME = 'Software Engineering Medley'
SITEURL = ' '

PATH = "content"

TIMEZONE = 'America/New_York'

DEFAULT_LANG = 'en'

# Feed generation is usually not desired when developing
FEED_ALL_ATOM = None
CATEGORY_FEED_ATOM = None
TRANSLATION_FEED_ATOM = None
AUTHOR_FEED_ATOM = None
AUTHOR_FEED_RSS = None

GITHUB_URL = "http://github.com/helkhalfi/"
THEME = "Flex"

# Blogroll
LINKS = (
#    ("Pelican", "https://getpelican.com/"),
#    ("Python.org", "https://www.python.org/"),
#    ("Jinja2", "https://palletsprojects.com/p/jinja/"),
#    ("You can modify those links in your config file", "#"),
)

# Social widget
SOCIAL = (
    ("linkedin", "https://www.linkedin.com/in/helkhalfi/"),
    ("github", "https://github.com/helkhalfi"),
)

PLUGINS = [
    'pelican.plugins.minify',
    'pelican.plugins.deadlinks',
    #'pelican.plugins.seo'
]


COPYRIGHT_YEAR = datetime.now().year
DEFAULT_PAGINATION = 10

DISPLAY_PAGES_ON_MENU = True

# "pelican.plugins.minify" section
CSS_MIN = True
JS_MIN = True
HTML_MIN = True
INLINE_CSS_MIN = True
INLINE_JS_MIN = True


THEME_COLOR_AUTO_DETECT_BROWSER_PREFERENCE = True
THEME_COLOR_ENABLE_USER_OVERRIDE = True

MAIN_MENU = True

MENUITEMS = (
    ("Archives", "/archives.html"),
    ("Categories", "/categories.html"),
    ("Tags", "/tags.html")
)

# Uncomment following line if you want document-relative URLs when developing
# RELATIVE_URLS = True

# Deadlinks plugin configurarion
DEADLINKS_VALIDATION = True
DEADLINKS_OPTIONS = {
    "archive": True,
    "classes": ["custom-class1", "disabled"],
    "labels": True,
    "timeout_duration_ms": 1000,
    "timeout_is_error": True,
}


# SEO Plugin
SEO_REPORT = True  # SEO report is enabled by default
SEO_ENHANCER = False  # SEO enhancer is disabled by default
SEO_ENHANCER_OPEN_GRAPH = False # Subfeature of SEO enhancer
SEO_ENHANCER_TWITTER_CARDS = False # Subfeature of SEO enhancer

# Typographically checks and transformations
TYPOGRIFY = True