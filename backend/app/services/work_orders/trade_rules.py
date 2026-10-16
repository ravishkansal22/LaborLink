"""Keyword rules used by the rule-based work-order provider.

Keywords are matched as whole words/phrases against the lower-cased description. A few common
Hindi/Hinglish words are included because employers often describe jobs that way.
Durations are rough labour-time ranges in hours.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.schemas.common import Complexity, Trade


@dataclass(frozen=True)
class ProblemRule:
    category: str
    summary: str
    keywords: tuple[str, ...]
    complexity: Complexity
    duration: tuple[float, float]
    tools: tuple[str, ...]
    materials: tuple[str, ...]
    questions: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class TradeRule:
    trade: Trade
    keywords: tuple[str, ...]
    problems: tuple[ProblemRule, ...]
    default_problem: ProblemRule


TRADE_RULES: dict[Trade, TradeRule] = {
    Trade.plumber: TradeRule(
        trade=Trade.plumber,
        keywords=("plumber", "plumbing", "pipe", "pipes", "pipeline", "bathroom fitting",
                  "leak", "leaking", "tap", "faucet", "drain",
                  "toilet", "flush", "sink", "basin", "geyser", "water tank", "nal", "pani",
                  "shower", "sewage", "blocked", "clogged", "valve"),
        problems=(
            ProblemRule("leak_repair", "Leaking pipe, tap or joint needs repair",
                        ("leak", "leaking", "dripping", "drip", "seepage", "tapak"),
                        Complexity.low, (1.0, 2.0),
                        ("pipe wrench", "adjustable spanner", "plumber's tape", "sealant gun"),
                        ("PTFE tape", "washers", "replacement fitting (if worn)"),
                        ("Is the leak from a visible pipe or from inside a wall?",)),
            ProblemRule("blockage_clearing", "Blocked drain, sink or toilet needs clearing",
                        ("blocked", "clogged", "choke", "choked", "overflow", "not draining"),
                        Complexity.medium, (1.0, 3.0),
                        ("plunger", "drain auger / snake", "bucket", "gloves"),
                        ("drain cleaner (if needed)",),
                        ("Which outlet is blocked (sink, toilet, floor drain)?",)),
            ProblemRule("fixture_installation", "Install or replace a plumbing fixture",
                        ("install", "replace", "new tap", "fit", "fitting", "geyser", "shower"),
                        Complexity.medium, (1.5, 3.0),
                        ("pipe wrench", "drill", "spanner set", "spirit level"),
                        ("fixture (supplied by employer?)", "connectors", "PTFE tape"),
                        ("Has the new fixture already been purchased?",)),
            ProblemRule("pipeline_work", "New pipeline or major pipe replacement",
                        ("pipeline", "new pipe", "replace pipe", "concealed", "bathroom fitting"),
                        Complexity.high, (4.0, 8.0),
                        ("pipe cutter", "threading machine", "drill", "chisel"),
                        ("CPVC/PVC pipes", "elbows and tees", "solvent cement"),
                        ("Approximately how many metres of pipe are involved?",)),
        ),
        default_problem=ProblemRule("general_plumbing", "General plumbing inspection and repair",
                                    (), Complexity.medium, (1.0, 3.0),
                                    ("pipe wrench", "spanner set", "plunger"),
                                    ("PTFE tape", "washers")),
    ),
    Trade.electrician: TradeRule(
        trade=Trade.electrician,
        keywords=("electrician", "electrical", "electric", "wiring", "wire", "switch", "socket",
                  "plug", "fan", "light", "bulb", "tubelight", "mcb", "fuse", "short circuit",
                  "spark", "sparking", "inverter", "bijli", "power", "meter", "board"),
        problems=(
            ProblemRule("fault_diagnosis", "Electrical fault (tripping, sparking or no power)",
                        ("short circuit", "spark", "sparking", "tripping", "trip", "no power",
                         "burning smell", "shock", "fuse", "not working", "switch board"),
                        Complexity.medium, (1.0, 3.0),
                        ("multimeter", "tester screwdriver", "insulated pliers", "wire stripper"),
                        ("MCB/fuse (if faulty)", "insulation tape", "wire"),
                        ("Is any part of the house currently without power?",)),
            ProblemRule("fixture_installation", "Install or replace a fan, light or switch",
                        ("install", "fit", "replace", "new fan", "ceiling fan", "light",
                         "tubelight", "switch", "socket"),
                        Complexity.low, (0.5, 1.5),
                        ("screwdriver set", "drill", "tester", "ladder"),
                        ("fixture (supplied by employer?)", "connectors", "insulation tape"),
                        ("How many fixtures need to be installed?",)),
            ProblemRule("rewiring", "Rewiring or new wiring for a room",
                        ("rewiring", "rewire", "new wiring", "concealed wiring", "wiring"),
                        Complexity.high, (4.0, 10.0),
                        ("drill", "chisel", "fish tape", "multimeter", "wire stripper"),
                        ("copper wire", "conduit", "switchboards", "MCB"),
                        ("How many rooms or points need wiring?",)),
        ),
        default_problem=ProblemRule("general_electrical",
                                    "General electrical inspection and repair",
                                    (), Complexity.medium, (1.0, 2.5),
                                    ("multimeter", "tester screwdriver", "insulated pliers"),
                                    ("insulation tape", "wire")),
    ),
    Trade.mason: TradeRule(
        trade=Trade.mason,
        keywords=("mason", "masonry", "brick", "bricks", "cement", "plaster", "plastering",
                  "wall", "deewar", "crack", "cracks", "tile", "tiles", "tiling", "flooring",
                  "concrete", "construction", "mistri", "waterproofing"),
        problems=(
            ProblemRule("crack_repair", "Wall or floor cracks need filling and patching",
                        ("crack", "cracks", "patch", "damaged plaster", "peeling"),
                        Complexity.low, (2.0, 4.0),
                        ("trowel", "chisel", "hammer", "mixing tub"),
                        ("cement", "sand", "crack filler / putty"),
                        ("Roughly how long and wide are the cracks?",)),
            ProblemRule("tiling", "Lay or replace floor or wall tiles",
                        ("tile", "tiles", "tiling", "flooring"),
                        Complexity.medium, (4.0, 8.0),
                        ("tile cutter", "trowel", "spirit level", "rubber mallet"),
                        ("tiles", "tile adhesive", "grout"),
                        ("What is the approximate area in square feet?",)),
            ProblemRule("wall_construction", "Build or rebuild a brick wall / structure",
                        ("build", "construct", "construction", "new wall", "brick", "bricks"),
                        Complexity.high, (8.0, 24.0),
                        ("trowel", "spirit level", "plumb line", "mixing tools"),
                        ("bricks", "cement", "sand"),
                        ("What are the wall dimensions (length x height)?",)),
            ProblemRule("plastering", "Plastering of walls or ceiling",
                        ("plaster", "plastering"),
                        Complexity.medium, (4.0, 8.0),
                        ("trowel", "float", "straight edge", "mixing tub"),
                        ("cement", "sand"),
                        ("What is the approximate area to be plastered?",)),
        ),
        default_problem=ProblemRule("general_masonry", "General masonry repair",
                                    (), Complexity.medium, (2.0, 6.0),
                                    ("trowel", "hammer", "chisel"),
                                    ("cement", "sand")),
    ),
    Trade.carpenter: TradeRule(
        trade=Trade.carpenter,
        keywords=("carpenter", "carpentry", "wood", "wooden", "door", "window", "cupboard",
                  "wardrobe", "almirah", "furniture", "table", "chair", "bed", "drawer",
                  "hinge", "lock", "shelf", "plywood", "kabat", "darwaza"),
        problems=(
            ProblemRule("door_window_repair", "Door or window not closing / hinge or lock repair",
                        ("door", "window", "hinge", "lock", "jammed", "stuck", "not closing",
                         "darwaza"),
                        Complexity.low, (1.0, 2.0),
                        ("screwdriver set", "drill", "chisel", "plane"),
                        ("hinges", "screws", "lock (if replacement needed)"),
                        ("Does the lock or hinge need replacement, or only adjustment?",)),
            ProblemRule("furniture_repair", "Repair of furniture (cupboard, table, chair, bed)",
                        ("cupboard", "wardrobe", "almirah", "table", "chair", "bed", "drawer",
                         "broken", "furniture"),
                        Complexity.medium, (1.5, 4.0),
                        ("drill", "clamps", "hammer", "saw"),
                        ("wood glue", "screws", "replacement panel (if needed)"),
                        ("Which piece of furniture, and what is broken?",)),
            ProblemRule("custom_build", "Build new furniture or fittings",
                        ("make", "build", "new", "custom", "shelf", "shelves", "modular"),
                        Complexity.high, (8.0, 24.0),
                        ("circular saw", "drill", "router", "measuring tape"),
                        ("plywood / timber", "laminate", "hardware fittings"),
                        ("What are the required dimensions and material?",)),
        ),
        default_problem=ProblemRule("general_carpentry", "General carpentry repair",
                                    (), Complexity.medium, (1.0, 3.0),
                                    ("screwdriver set", "drill", "hammer"),
                                    ("screws", "wood glue")),
    ),
}

UNKNOWN_DURATION = (1.0, 4.0)
