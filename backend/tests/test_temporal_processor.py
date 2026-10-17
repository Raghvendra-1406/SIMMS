"""4-of-5 confirmation window (Plan v2 §7.1)."""

from services import temporal_processor as tp

ROOM = 1
FAULT = "TEST_FAULT"


def vote(abnormal):
    return tp.add_observation(ROOM, FAULT, abnormal)


def test_single_blip_never_confirms():
    results = [vote(v) for v in (True, False, False, False, False, False)]
    assert not any(r["confirmed"] for r in results)


def test_four_of_five_confirms_once_window_is_full():
    results = [vote(v) for v in (True, True, True, True)]
    assert not results[-1]["confirmed"], "window not full yet"

    result = vote(False)
    assert result["confirmed"] and result["abnormal_count"] == 4
    assert result["needs_handling"]


def test_handling_reruns_only_every_recheck_interval():
    for _ in range(5):
        vote(True)

    handled = [vote(True)["needs_handling"] for _ in range(tp.RECHECK_EVERY)]
    # Streak 2..13: handled again only when streak % RECHECK_EVERY == 1.
    assert handled.count(True) == 1


def test_recovery_needs_three_of_five_normal():
    for _ in range(5):
        vote(True)

    assert not vote(False)["newly_recovered"]
    assert not vote(False)["newly_recovered"]
    assert vote(False)["newly_recovered"]
    assert not vote(False)["newly_recovered"], "reported once, not on every reading"


def test_onset_is_first_abnormal_vote_of_the_confirming_window():
    vote(True)                     # stale blip, falls out of the window
    for _ in range(4):
        vote(False)

    first = vote(True)
    window_key = tp.get_window_key(ROOM, FAULT, None)
    onset_time = tp._vote_times[window_key][-1]

    for _ in range(3):
        result = vote(True)

    assert result["confirmed"]
    assert first["onset_at"] is None
    assert result["onset_at"] == onset_time


def test_clear_window_resets_everything():
    for _ in range(5):
        vote(True)

    tp.clear_window(ROOM, FAULT)

    result = vote(True)
    assert result["window_size"] == 1 and result["onset_at"] is None
