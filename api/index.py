import json
import os
import random
from http.server import BaseHTTPRequestHandler
from groq import Groq
from openai import OpenAI

# Initialize clients
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
gemini_client = OpenAI(
    api_key=os.environ.get("GEMINI_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    max_retries=1
)

# ---------------------------------------------------------------------------
# Server-side entropy.
#
# Each request is an independent model call with no memory of any previous
# generation, so the model reliably collapses to its single most-probable
# "portfolio" aesthetic (dark slate + blue/cyan + glassmorphism). Telling it
# to "be unique" cannot fix that — it has no reference point for what it
# already made. Instead we randomise the starting constraints in Python so
# every request genuinely begins somewhere different.
# ---------------------------------------------------------------------------

COLOR_WORLDS = [
    "deep forest greens with bone white and a single burnt-orange accent",
    "warm terracotta, sand, and cream — earthy and sunlit",
    "high-contrast black and white with one acid yellow accent",
    "dusty rose, oxblood, and warm grey",
    "muted olive, mustard, and aged paper tones",
    "deep plum and blush pink with gold hairlines",
    "ocean navy with coral and sea-glass mint",
    "monochrome warm greys with a deep crimson accent",
    "pale butter yellow, soft charcoal, and sage",
    "rich chocolate brown, caramel, and ivory",
    "cold slate blue with rust and pale sky",
    "off-white paper with ink black and vermilion — editorial print feel",
    "twilight indigo, amber lamplight, and soft lilac",
    "seafoam, driftwood grey, and pale peach",
    "deep teal, copper, and warm sand",
]

TYPE_MOODS = [
    "a high-contrast serif for headings against a clean grotesque body",
    "all-monospace, treated as a design choice rather than a code reference",
    "an oversized geometric sans with very tight letter spacing",
    "a classic book serif throughout, generous line height, editorial",
    "a condensed bold display face paired with a humanist sans body",
    "soft rounded sans with playful weight contrast",
    "elegant light-weight serif headings with small-caps labels",
    "brutalist heavy sans, huge sizes, minimal hierarchy",
]

LAYOUT_SHAPES = [
    "a single narrow centred column that reads like a long-form article",
    "an asymmetric split — a fixed visual side and a scrolling content side",
    "a magazine grid with deliberately uneven column widths",
    "full-bleed alternating bands, each section its own coloured world",
    "a dense modular grid of differently-sized blocks",
    "generous vertical rhythm with large empty space between few elements",
    "a horizontal-feeling layout with strong left-aligned indentation",
    "stacked cards with heavy offset and overlap",
    "a timeline-driven vertical spine with content branching off it",
    "poster-style — one enormous focal element, supporting detail small",
]

TEXTURE_NOTES = [
    "flat solid colour blocks, no shadows, no blur",
    "thin hairline rules and borders as the main structural device",
    "soft paper-like warmth, subtle grain feeling through colour choice",
    "hard geometric shapes and strong rectangular divisions",
    "very high contrast edges, almost printed-poster feeling",
    "rounded, soft, generous corner radii throughout",
    "sharp zero-radius corners everywhere, strictly rectilinear",
    "layered depth through overlapping solid shapes rather than blur",
]


def build_creative_constraints():
    """Pick a fresh random visual starting point for this specific request."""
    return (
        f"- Colour world: {random.choice(COLOR_WORLDS)}\n"
        f"- Typography feeling: {random.choice(TYPE_MOODS)}\n"
        f"- Layout shape: {random.choice(LAYOUT_SHAPES)}\n"
        f"- Surface treatment: {random.choice(TEXTURE_NOTES)}"
    )


def load_profile_data():
    """Locate and load profile.json from data/ or root directory."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    candidate_paths = [
        os.path.join(base_dir, "data", "profile.json"),
        os.path.join(base_dir, "profile.json"),
        os.path.join(os.getcwd(), "data", "profile.json"),
        os.path.join(os.getcwd(), "profile.json")
    ]

    for path in candidate_paths:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return f.read()

    return "{}"


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            body = json.loads(post_data.decode('utf-8'))

            user_intent = body.get('intent', '').strip()
            screen_info = body.get('screen', {})

            device_type = screen_info.get('deviceType', 'Desktop')
            screen_width = screen_info.get('screenWidth', 1200)

            if not user_intent:
                self._send_json(400, {"error": "No intent provided."})
                return

            profile_json_str = load_profile_data()
            creative_constraints = build_creative_constraints()

            # STEP 1: Intent & mood reader.
            # No fixed modes, no menu of archetypes. It reads what the person
            # actually wants and what mood they're in, then writes a brief
            # for the builder in its own words.
            router_prompt = (
                "You are a perceptive creative director. A visitor has just arrived at "
                "Sagnik Gope's personal site and typed a sentence saying why they're here. "
                "Your job is to read them — what they actually want, and what mood they're in — "
                "and write a short creative brief for the engineer who will build their page.\n\n"
                f"What the visitor typed: '{user_intent}'\n"
                f"Their screen: {device_type}, {screen_width}px wide\n\n"
                "Think about:\n"
                "- What do they actually want to walk away with? Information? A story? Amusement? A quick answer? To kill five minutes?\n"
                "- What is their mood and energy? Formal and time-pressed? Playful? Curious? Skeptical? Bored? Affectionate (someone who knows him)?\n"
                "- What SHAPE should the content take to serve that? An article? A story with chapters? Flashcards? A single dense summary card? A slow reveal? Something else entirely that you invent for this person?\n"
                "- How much should they have to read before they get value?\n\n"
                "RELEVANCE: If what they typed has nothing to do with Sagnik, his work, his background, or looking at this site at all (e.g. they ask you to write their homework, ask an unrelated general question, or type nonsense), say so plainly in your brief and note that the page should open with a short friendly line acknowledging that, then simply introduce Sagnik straightforwardly.\n\n"
                "These visual constraints have already been chosen for this page — build your brief around them, do not contradict them:\n"
                f"{creative_constraints}\n\n"
                "Write 3-5 sentences of direction: the emotional register, the content shape you want, what to lead with, what to leave out, and how it should feel to move through the page. Be specific and opinionated. Write only the brief, nothing else."
            )

            intent_response = client.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=[{"role": "user", "content": router_prompt}],
                temperature=0.9,
                max_tokens=400
            )
            intent_content = intent_response.choices[0].message.content
            creative_brief = intent_content.strip() if intent_content else (
                "The visitor's purpose is unclear, so give them a calm, confident, "
                "straightforward introduction to Sagnik and his work, easy to scan quickly."
            )

            # STEP 2: The builder.
            system_ui_prompt = f"""You are an exceptional designer and frontend engineer. You build one-of-a-kind web experiences — not templates, not portfolio boilerplate.
            Your job right now: take the real facts about Sagnik Gope below and present them to ONE specific visitor, in whatever form genuinely serves what that visitor came for.
            GROUND TRUTH PROFILE DATA (the only facts you may use):
            ---
            {profile_json_str}
            ---
            WHAT THE VISITOR TYPED: "{user_intent}"
            CREATIVE BRIEF FROM THE DIRECTOR:{creative_brief}
            VISUAL CONSTRAINTS FOR THIS PAGE (follow these — they are what make this page different from every other one): {creative_constraints}
            DEVICE CONTEXT:
            - Device: {device_type}
            - Viewport width: {screen_width}px
            Design for this width specifically. Single column and large touch targets on mobile; use the horizontal room on desktop.

            HOW TO THINK ABOUT THIS:
            - There is no required set of sections. Decide what this visitor needs to see, in what order, and leave out what they don't. Someone who asked for a story does not need a skills grid. Someone evaluating him for a role does not need a slow narrative.
            - The structure should come from the visitor's purpose, not from what portfolio sites usually look like. If flashcards serve them better than sections, build flashcards. If one long piece of prose serves them better, build that.
            - Commit fully to one idea. A page that does one thing confidently beats a page hedging between three.
            - Everything on the page must ultimately represent Sagnik — his work, his background, his way of thinking. That is the point of the page regardless of what form it takes.

            INTERACTIVITY:
            Your output runs as static HTML inside a sandboxed iframe. Inline JavaScript works. There is NO backend, NO server, NO API you can call.
            - If you build something interactive (a quiz, flashcards, a reveal, a stepped walkthrough), write real working vanilla JS inline so it actually functions.
            - Never render a control that does nothing. No buttons that don't respond, no fake status readouts, no "loading" states that never resolve, no simulated terminals waiting for input that never processes anything. If you can't make it genuinely work, don't put it on the page.

            HARD RULES:
            - FACTUAL INTEGRITY: use only what is in the profile data above. Never invent achievements, numbers, dates, quotes, employers, or events — not even inside a story or a game. A story must be built from true facts.
            - Include a real way to reach him: https://gopesagnik.in/contact/ (with target="_blank", so it would open in new tab)
            - If URL mentioned for any skills, projects, certification in the data, link it with proper word, with hyperlink nderline format with target="_blank", so it would open in a new tab.
            - Use Tailwind CSS utility classes. Only real Tailwind classes — either the built-in palette (i.e. bg-stone-800, text-emerald-400) or arbitrary values with actual hex codes (i.e. bg-[#2A404D]). Never invent palette names like bg-terracotta-500; they compile to nothing and render unstyled.
            - OUTPUT FORMAT: pure raw HTML suitable for insertion inside `<body>`. No `<!DOCTYPE html>`, `<html>`, `<head>`, or `<body>` tags. No markdown fences.
            - No in-page navigation: no navbar, no anchor links like #contact or #about.
            """

            ui_response = gemini_client.chat.completions.create(
                model="gemini-3.6-flash",
                messages=[
                    {"role": "system", "content": system_ui_prompt},
                    {"role": "user", "content": f"Visitor query: {user_intent}\nBuild their page now."}
                ],
                temperature=0.95,
                max_tokens=16000
            )

            # 1. Safely extract content with null-checks
            ui_content = ui_response.choices[0].message.content
            if not ui_content:
                self._send_json(500, {"error": "Gemini blocked the response or returned empty content."})
                return

            generated_html = ui_content.strip()

            # 2. Clean markdown fences if generated
            if generated_html.startswith("```html"):
                generated_html = generated_html[7:]
            elif generated_html.startswith("```"):
                generated_html = generated_html[3:]
            if generated_html.endswith("```"):
                generated_html = generated_html[:-3]

            # 3. Send final HTML to the frontend
            self._send_json(200, {"html": generated_html.strip()})

        # except Exception as e:
        #     print(f"Error during generation: {str(e)}")
        #     self._send_json(500, {"error": f"Generation failed: {str(e)}"})

        except Exception as e:
            error_str = str(e)
            print(f"Error during generation: {error_str}")
            
            # Intercept Gemini's specific quota/rate-limit errors
            if "429" in error_str or "Quota" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                sarcastic_msg = "Congratulations, you're visitor #20! My free-tier AI has officially run out of brain juice for the day. Come back tomorrow when Google forgives me."
                self._send_json(429, {"error": sarcastic_msg})
            else:
                self._send_json(500, {"error": "Well, something broke. Please send a feedback: https://gopesagnik.in/contact/"})

    def _send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))