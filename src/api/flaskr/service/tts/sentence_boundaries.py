"""
Shared sentence boundary helpers for TTS segmentation.

Strong punctuation marks always qualify as segment boundaries.
Weak punctuation marks such as commas only qualify when the current clause
is long enough, which avoids over-fragmenting live streaming TTS.
"""

from __future__ import annotations

from collections.abc import Iterator


STRONG_SENTENCE_ENDING_CHARS = frozenset(".!?。！？；;")
WEAK_SENTENCE_ENDING_CHARS = frozenset(",，")
DEFAULT_WEAK_BOUNDARY_MIN_CHARS = 16


def iter_sentence_boundary_positions(
    text: str,
    *,
    weak_boundary_min_chars: int = DEFAULT_WEAK_BOUNDARY_MIN_CHARS,
) -> Iterator[int]:
    """
    Yield sentence boundary end positions for the given text.

    Strong endings are always emitted. Weak endings are emitted only when the
    current clause length reaches the configured minimum.
    """
    if not text:
        return

    clause_start = 0
    min_chars = max(int(weak_boundary_min_chars or 0), 1)

    for idx, char in enumerate(text):
        if char in STRONG_SENTENCE_ENDING_CHARS:
            yield idx + 1
            clause_start = idx + 1
            continue

        if char not in WEAK_SENTENCE_ENDING_CHARS:
            continue

        clause_text = text[clause_start : idx + 1].strip()
        if len(clause_text) < min_chars:
            continue

        yield idx + 1
        clause_start = idx + 1
