from app.config import THRESH


def decide(
    road_score,
    pothole_conf,
    pothole_count,
    area_ratio,
    ai_gen_score,
    is_duplicate,
    accuracy_m,
):
    if road_score < THRESH["road"]:
        return "green", "Not a road photo"
    if is_duplicate:
        return "green", "Duplicate of an existing image"
    if pothole_conf < THRESH["pothole_min"]:
        return "green", "No pothole detected"
    yellow = []
    if ai_gen_score >= THRESH["ai_suspect"]:
        yellow.append("image may be AI-generated or edited")
    if pothole_conf < THRESH["pothole_strong"]:
        yellow.append("low detection confidence")
    if accuracy_m is not None and accuracy_m > THRESH["acc_max"]:
        yellow.append("weak GPS accuracy")
    if yellow:
        return "yellow", "Needs review: " + ", ".join(yellow)
    if area_ratio >= THRESH["area_red"] or pothole_count >= THRESH["count_red"]:
        return "red", f"{pothole_count} pothole(s), covers {area_ratio:.0%} of frame"
    return "yellow", "Small pothole, lower priority"
