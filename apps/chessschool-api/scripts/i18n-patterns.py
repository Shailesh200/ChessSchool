"""Fills templated course lines (null in data/i18n/<lang>/*.json) from patterns. Used by build-course-text."""
import re

PIECES_HI = {"queen": ("रानी", "की अपनी"), "rook": ("हाथी", "के अपने"), "bishop": ("ऊँट", "के अपने"), "knight": ("घोड़े", "के अपने"), "king": ("राजा", "के अपने"), "pawn": ("प्यादे", "के अपने")}

def hi(en):
    m = re.fullmatch(r"Start with your (\w+) on ([a-h][1-8])\.( After Black replies, look for the follow-up\.)?", en)
    if m:
        piece, poss = PIECES_HI[m.group(1)]
        s = f"{m.group(2)} {poss} {piece} से शुरू करें।"
        return s + (" काले के जवाब के बाद अगली चाल ढूँढें।" if m.group(3) else "")
    return None
