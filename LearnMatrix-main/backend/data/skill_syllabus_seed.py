"""
data/skill_syllabus_seed.py

Hand-authored seed content for the Skill Syllabus Tree — the ordered
curriculum inside each skill (roadmap_service.py currently only knows
"HTML5 = 82%"; this file is what lets it eventually know "82% means
Semantic HTML onward is still open").

Scope of this seed: the "frontend" role only, matching
frontend/src/constants/skills.js -> ROLE_SKILLS.frontend exactly (same
14 skill names, same category grouping) so nothing here invents a skill
the frontend doesn't already select. Other roles (backend, aiml, data,
cloud, cyber, android, fullstack) are NOT seeded yet — add a new
ROLE_ID -> {skill: [...]} entry below, following the same shape, when
ready to expand.

Shape
-----
SKILL_SYLLABUS[roleId][skillName] = list of topic rows, IN ORDER.
Each row is a plain dict consumed by models.skill_topic_model.SkillTopic
.from_seed() — see that file for field meanings. `PrerequisiteTopicIds`
defaults to "the topic immediately before this one" wherever a skill's
topics are strictly linear; only branching points list something else
explicitly.

TopicID convention: "<skill-slug>-<NN>", zero-padded, stable forever
once assigned (never renumber existing rows — append new topics at the
end of a skill's list, or insert them and shift only rows that haven't
shipped to any learner_topic_progress document yet).
"""


def _linear(skill_slug: str, titles_and_meta: list[tuple[str, str, str, int]]) -> list[dict]:
    """
    Helper for the common case: a skill whose topics are studied strictly
    in order, each depending only on the one before it.

    titles_and_meta: list of (Title, Description, Difficulty, EstimatedMinutes)
    """
    rows = []
    prev_id = None
    for i, (title, desc, difficulty, minutes) in enumerate(titles_and_meta, start=1):
        topic_id = f"{skill_slug}-{i:02d}"
        rows.append({
            "TopicID": topic_id,
            "Title": title,
            "Order": i,
            "Description": desc,
            "Difficulty": difficulty,
            "EstimatedMinutes": minutes,
            "PrerequisiteTopicIds": [prev_id] if prev_id else [],
        })
        prev_id = topic_id
    return rows


SKILL_SYLLABUS: dict[str, dict[str, list[dict]]] = {
    "frontend": {

        # --- Core ---

        "HTML5": _linear("html5", [
            ("Introduction", "What HTML is, how it structures the web, and how a browser parses it.", "Beginner", 20),
            ("HTML Document Structure", "doctype, html/head/body, the anatomy of every page.", "Beginner", 20),
            ("Headings", "h1-h6, document outline, and when to use which level.", "Beginner", 15),
            ("Paragraphs", "Text content, line breaks, and basic inline formatting.", "Beginner", 15),
            ("Lists", "Ordered, unordered, and description lists.", "Beginner", 15),
            ("Images", "img tag, alt text, responsive images with srcset.", "Beginner", 20),
            ("Hyperlinks", "Anchor tags, relative vs absolute URLs, targets.", "Beginner", 15),
            ("Tables", "Tabular data markup, thead/tbody, accessible tables.", "Intermediate", 25),
            ("Forms", "Input types, labels, validation attributes, form submission.", "Intermediate", 35),
            ("Semantic HTML", "header, nav, main, article, section, footer — meaning over divs.", "Intermediate", 25),
            ("Accessibility", "ARIA basics, alt text, focus order, screen-reader friendly markup.", "Intermediate", 30),
            ("SEO Basics", "Meta tags, heading hierarchy, semantic structure for search engines.", "Intermediate", 20),
            ("Best Practices", "Validation, indentation conventions, avoiding div soup.", "Intermediate", 15),
            ("Mini Project", "Build a semantic, accessible one-page profile using everything above.", "Intermediate", 60),
        ]),

        "CSS3": _linear("css3", [
            ("Introduction", "What CSS does, how it's linked, the cascade at a glance.", "Beginner", 15),
            ("Selectors", "Element, class, id, attribute, and combinator selectors.", "Beginner", 20),
            ("Colors", "Color formats (hex, rgb, hsl), currentColor, opacity.", "Beginner", 15),
            ("Typography", "font-family, sizing units, line-height, text alignment.", "Beginner", 20),
            ("Box Model", "content, padding, border, margin — and box-sizing.", "Beginner", 25),
            ("Position", "static, relative, absolute, fixed, sticky.", "Intermediate", 25),
            ("Display", "block, inline, inline-block, none, and how layout changes.", "Beginner", 15),
            ("Flexbox", "One-dimensional layout: main/cross axis, grow/shrink/basis.", "Intermediate", 35),
            ("Grid", "Two-dimensional layout: tracks, areas, fr units.", "Intermediate", 35),
            ("Responsive Design", "Fluid layouts, relative units, mobile-first thinking.", "Intermediate", 25),
            ("Media Queries", "Breakpoints, orientation, min/max-width.", "Intermediate", 20),
            ("Animations", "@keyframes, animation properties, easing.", "Advanced", 30),
            ("Transitions", "transition-property/duration/timing-function on state change.", "Intermediate", 20),
            ("CSS Variables", "Custom properties, theming, scoping with :root.", "Intermediate", 20),
            ("Mini Project", "Build a fully responsive landing page section using Flexbox + Grid.", "Intermediate", 60),
        ]),

        "JavaScript": _linear("js", [
            ("Variables", "var/let/const, scope, hoisting basics.", "Beginner", 20),
            ("Data Types", "Primitives vs objects, typeof, type coercion.", "Beginner", 20),
            ("Operators", "Arithmetic, comparison, logical, ternary.", "Beginner", 15),
            ("Conditions", "if/else, switch, truthy/falsy values.", "Beginner", 15),
            ("Loops", "for, while, for...of, for...in, break/continue.", "Beginner", 20),
            ("Functions", "Declarations, expressions, arrow functions, default params.", "Beginner", 25),
            ("Arrays", "Common methods: map, filter, reduce, find, sort.", "Beginner", 30),
            ("Objects", "Object literals, property access, destructuring.", "Beginner", 25),
            ("Strings", "Template literals, common string methods.", "Beginner", 15),
            ("DOM", "Selecting and manipulating elements, traversing the tree.", "Intermediate", 30),
            ("Events", "addEventListener, event object, bubbling/capturing.", "Intermediate", 25),
            ("Fetch API", "Making HTTP requests, handling responses.", "Intermediate", 25),
            ("JSON", "Parsing/stringifying, working with API payloads.", "Beginner", 15),
            ("ES6+", "let/const, arrow functions, spread/rest, modules recap and beyond.", "Intermediate", 25),
            ("Async/Await", "Promises, async functions, error handling in async code.", "Advanced", 35),
            ("Error Handling", "try/catch, custom errors, defensive coding.", "Intermediate", 20),
            ("Modules", "import/export, splitting code across files.", "Intermediate", 20),
            ("Local Storage", "Persisting small data client-side, JSON serialization.", "Beginner", 15),
            ("Mini Project", "Build an interactive to-do app using DOM + events + localStorage.", "Intermediate", 60),
        ]),

        "TypeScript": _linear("ts", [
            ("Introduction", "Why static types, how TS compiles to JS.", "Beginner", 15),
            ("Basic Types", "string, number, boolean, arrays, tuples, any/unknown.", "Beginner", 20),
            ("Interfaces & Types", "type aliases vs interfaces, optional/readonly props.", "Intermediate", 25),
            ("Functions", "Typed parameters, return types, overloads.", "Intermediate", 20),
            ("Generics", "Reusable typed components and functions.", "Advanced", 30),
            ("Union & Narrowing", "Union types, type guards, discriminated unions.", "Advanced", 25),
            ("Typing React Props", "Typing components, hooks, and event handlers in JSX.", "Advanced", 30),
            ("Mini Project", "Convert a small JS module to fully-typed TypeScript.", "Intermediate", 45),
        ]),

        # --- Frameworks ---

        "Bootstrap": _linear("bootstrap", [
            ("Introduction & Setup", "CDN vs npm install, base template.", "Beginner", 15),
            ("Grid System", "Container, row, column breakpoints.", "Beginner", 20),
            ("Utility Classes", "Spacing, text, display, flex utilities.", "Beginner", 20),
            ("Components", "Navbar, cards, modals, buttons.", "Intermediate", 25),
            ("Forms", "Bootstrap form controls and validation states.", "Intermediate", 20),
            ("Customization", "Overriding Sass variables, theming.", "Advanced", 25),
            ("Mini Project", "Build a responsive landing page using only Bootstrap components.", "Intermediate", 45),
        ]),

        "Tailwind CSS": _linear("tailwind", [
            ("Introduction & Setup", "Utility-first philosophy, install + config.", "Beginner", 20),
            ("Core Utilities", "Spacing, sizing, typography, color scales.", "Beginner", 25),
            ("Flexbox & Grid Utilities", "Layout classes, responsive prefixes.", "Intermediate", 25),
            ("Responsive Design", "sm:/md:/lg: breakpoint prefixes.", "Intermediate", 20),
            ("States & Variants", "hover:, focus:, dark: variants.", "Intermediate", 20),
            ("Custom Theme", "Extending tailwind.config.js, custom colors/fonts.", "Advanced", 25),
            ("Component Extraction", "@apply, reusable class patterns.", "Advanced", 20),
            ("Mini Project", "Rebuild a UI mock using only Tailwind utility classes.", "Intermediate", 45),
        ]),

        "React.js": _linear("react", [
            ("JSX", "Syntax, embedding expressions, fragments.", "Beginner", 20),
            ("Components", "Function components, composition, reusability.", "Beginner", 20),
            ("Props", "Passing data down, prop types, children.", "Beginner", 20),
            ("State", "useState, re-renders, updating state correctly.", "Beginner", 25),
            ("Hooks", "useEffect, useRef, useMemo, useCallback, custom hooks.", "Intermediate", 40),
            ("Routing", "React Router: routes, params, nested routes, navigation.", "Intermediate", 30),
            ("Forms", "Controlled inputs, validation, submission handling.", "Intermediate", 25),
            ("API Integration", "Fetching data with useEffect, loading/error states.", "Intermediate", 30),
            ("Context API", "Sharing state without prop drilling.", "Advanced", 25),
            ("Performance Optimization", "memo, useMemo/useCallback, avoiding unnecessary renders.", "Advanced", 30),
            ("Deployment", "Building for production, deploying to Vercel/Netlify.", "Intermediate", 20),
            ("Major Project", "Build a full CRUD app consuming a real API.", "Advanced", 90),
        ]),

        "Next.js": _linear("nextjs", [
            ("Introduction & Setup", "File-based routing, project structure.", "Beginner", 20),
            ("Pages & Routing", "Static and dynamic routes, nested layouts.", "Intermediate", 25),
            ("Data Fetching", "getStaticProps/getServerSideProps, App Router fetch patterns.", "Intermediate", 35),
            ("API Routes", "Building backend endpoints inside a Next.js app.", "Intermediate", 25),
            ("Rendering Strategies", "SSR vs SSG vs ISR vs CSR — when to use which.", "Advanced", 30),
            ("Image & Font Optimization", "next/image, next/font, performance defaults.", "Intermediate", 20),
            ("Deployment", "Deploying to Vercel, environment variables.", "Beginner", 20),
            ("Mini Project", "Build a blog with static generation and dynamic routes.", "Advanced", 60),
        ]),

        # --- UI/UX ---

        "Responsive Design": _linear("respdesign", [
            ("Mobile-First Thinking", "Designing from the smallest screen up.", "Beginner", 15),
            ("Fluid Layouts", "Relative units (%, rem, vw/vh) over fixed pixels.", "Beginner", 20),
            ("Breakpoints", "Choosing sensible breakpoints, avoiding device-specific ones.", "Intermediate", 20),
            ("Responsive Images & Media", "srcset, picture element, aspect-ratio.", "Intermediate", 20),
            ("Testing Across Devices", "DevTools device toolbar, real-device quirks.", "Beginner", 15),
            ("Mini Project", "Make an existing fixed-width page fully responsive.", "Intermediate", 45),
        ]),

        "Figma Basics": _linear("figma", [
            ("Interface Overview", "Canvas, layers, pages, toolbar.", "Beginner", 15),
            ("Frames & Layout", "Auto layout, constraints, grids.", "Beginner", 20),
            ("Components & Variants", "Reusable components, variant properties.", "Intermediate", 25),
            ("Prototyping", "Linking screens, transitions, interactive previews.", "Intermediate", 20),
            ("Dev Handoff", "Inspect panel, exporting assets, reading spacing/color specs.", "Beginner", 15),
        ]),

        "CSS Animations": _linear("cssanim", [
            ("Transitions Recap", "When transitions are enough vs when you need keyframes.", "Beginner", 15),
            ("Keyframes", "@keyframes syntax, multiple steps, animation-fill-mode.", "Intermediate", 25),
            ("Timing & Easing", "cubic-bezier, steps(), perceived performance.", "Intermediate", 20),
            ("Transform", "translate, scale, rotate, and combining transforms.", "Intermediate", 20),
            ("Performance", "Animating transform/opacity vs layout-triggering properties.", "Advanced", 20),
            ("Mini Project", "Build a set of micro-interactions (button, card hover, loader).", "Intermediate", 40),
        ]),

        "Accessibility (WCAG)": _linear("a11y", [
            ("Why Accessibility Matters", "Disability categories, legal/ethical context, WCAG overview.", "Beginner", 15),
            ("Semantic HTML for A11y", "Native elements over ARIA wherever possible.", "Beginner", 20),
            ("ARIA Roles & Attributes", "When and how to use ARIA correctly (and when not to).", "Intermediate", 25),
            ("Keyboard Navigation", "Focus order, visible focus states, skip links.", "Intermediate", 20),
            ("Color Contrast", "WCAG AA/AAA thresholds, contrast tools.", "Beginner", 15),
            ("Screen Reader Testing", "Testing with NVDA/VoiceOver, common pitfalls.", "Advanced", 25),
            ("Mini Project", "Audit and fix accessibility issues on an existing page.", "Intermediate", 45),
        ]),

        # --- Tools ---

        "Git": _linear("git", [
            ("Introduction", "What version control solves, git vs GitHub.", "Beginner", 15),
            ("Init & Config", "git init, global config, .gitignore.", "Beginner", 10),
            ("Staging & Committing", "add, commit, writing good commit messages.", "Beginner", 15),
            ("Branching", "Creating, switching, merging branches.", "Beginner", 20),
            ("Merge Conflicts", "Reading conflict markers, resolving manually.", "Intermediate", 25),
            ("Remotes", "Cloning, push, pull, fetch, tracking branches.", "Beginner", 20),
            ("Rebase vs Merge", "When to use each, interactive rebase basics.", "Advanced", 25),
            ("Undoing Changes", "checkout, reset, revert, stash.", "Intermediate", 20),
            ("Mini Project", "Simulate a feature-branch workflow with a deliberate conflict to resolve.", "Intermediate", 30),
        ]),

        "GitHub": _linear("github", [
            ("Repositories", "Creating repos, README, topics, visibility.", "Beginner", 15),
            ("Pull Requests", "Opening PRs, review comments, requesting changes.", "Beginner", 20),
            ("Issues & Projects", "Tracking work, labels, linking issues to PRs.", "Beginner", 15),
            ("GitHub Actions Basics", "What CI/CD is, a minimal workflow file.", "Intermediate", 25),
            ("Collaboration Workflow", "Forks, branch protection, code review etiquette.", "Intermediate", 20),
        ]),

        "Vite": _linear("vite", [
            ("Why Vite", "Dev server speed, ESM-native bundling vs older bundlers.", "Beginner", 10),
            ("Project Setup", "Scaffolding a project, folder structure, config file.", "Beginner", 15),
            ("Environment Variables", "import.meta.env, .env files, VITE_ prefix rule.", "Beginner", 15),
            ("Plugins", "Adding React/Tailwind plugins, common plugin patterns.", "Intermediate", 15),
            ("Build & Deploy", "vite build output, preview, deployment basics.", "Beginner", 15),
        ]),
    },
}


def get_role_ids() -> list[str]:
    return list(SKILL_SYLLABUS.keys())


def get_skills_for_role(role_id: str) -> list[str]:
    return list(SKILL_SYLLABUS.get(role_id, {}).keys())


def iter_seed_rows(role_id: str):
    """
    Yields fully-formed seed rows (Skill + all SkillTopic fields) for every
    topic under every skill of one role — the flat shape
    scripts/upload_skill_topics.py needs to hand to SkillTopic.from_seed().
    """
    skills = SKILL_SYLLABUS.get(role_id, {})
    for skill_name, topics in skills.items():
        for row in topics:
            yield {**row, "Skill": skill_name}
