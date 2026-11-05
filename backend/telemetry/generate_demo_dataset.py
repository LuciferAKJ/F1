"""Generate high-integrity 5-lap Bahrain demo dataset for F1 Race Replay."""
import bisect
import math
import os
import pickle
import sys

# Ensure backend imports work
sys.path.insert(0, os.path.abspath("backend"))

from models.schemas import DriverMeta, SessionInfo
from telemetry.models import DriverFrame, ProcessedSession, ReplayData, ReplayFrame

DEMO_DRIVERS = [
    DriverMeta(abbreviation="VER", team_name="Red Bull Racing", team_color="#3671C6", driver_number="1"),
    DriverMeta(abbreviation="NOR", team_name="McLaren", team_color="#FF8000", driver_number="4"),
    DriverMeta(abbreviation="LEC", team_name="Ferrari", team_color="#E80020", driver_number="16"),
    DriverMeta(abbreviation="HAM", team_name="Mercedes", team_color="#27F4D2", driver_number="44"),
    DriverMeta(abbreviation="PIA", team_name="McLaren", team_color="#FF8000", driver_number="81"),
    DriverMeta(abbreviation="SAI", team_name="Ferrari", team_color="#E80020", driver_number="55"),
    DriverMeta(abbreviation="RUS", team_name="Mercedes", team_color="#27F4D2", driver_number="63"),
    DriverMeta(abbreviation="PER", team_name="Red Bull Racing", team_color="#3671C6", driver_number="11"),
    DriverMeta(abbreviation="ALO", team_name="Aston Martin", team_color="#229971", driver_number="14"),
    DriverMeta(abbreviation="STR", team_name="Aston Martin", team_color="#229971", driver_number="18"),
]

DRIVER_TYRES = {
    "VER": "MEDIUM",
    "NOR": "MEDIUM",
    "LEC": "SOFT",
    "HAM": "MEDIUM",
    "PIA": "SOFT",
    "SAI": "HARD",
    "RUS": "SOFT",
    "PER": "MEDIUM",
    "ALO": "HARD",
    "STR": "MEDIUM",
}


def build_demo_replay():
    # Load original circuit points
    asset_path = "backend/assets/demo/demo_replay.pkl"
    with open(asset_path, "rb") as f:
        orig = pickle.load(f)

    xs = orig.circuit.x
    ys = orig.circuit.y
    n_pts = len(xs)

    # Precompute cumulative distance along track
    cum_dist = [0.0]
    for i in range(1, n_pts):
        d = math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1])
        cum_dist.append(cum_dist[-1] + d)

    closing_d = math.hypot(xs[0] - xs[-1], ys[0] - ys[-1])
    track_length = cum_dist[-1] + closing_d

    # Sector boundaries (3 sectors)
    s1_end = track_length / 3.0
    s2_end = 2.0 * track_length / 3.0

    def get_track_point(s: float):
        s = s % track_length
        if s >= cum_dist[-1]:
            frac = (s - cum_dist[-1]) / max(closing_d, 1e-6)
            x = xs[-1] + frac * (xs[0] - xs[-1])
            y = ys[-1] + frac * (ys[0] - ys[-1])
            tangent = math.atan2(ys[0] - ys[-1], xs[0] - xs[-1])
        else:
            idx = bisect.bisect_right(cum_dist, s) - 1
            idx = max(0, min(idx, n_pts - 2))
            seg_len = cum_dist[idx + 1] - cum_dist[idx]
            frac = (s - cum_dist[idx]) / max(seg_len, 1e-6)
            x = xs[idx] + frac * (xs[idx + 1] - xs[idx])
            y = ys[idx] + frac * (ys[idx + 1] - ys[idx])
            tangent = math.atan2(ys[idx + 1] - ys[idx], xs[idx + 1] - xs[idx])
        return x, y, tangent

    def get_base_speed(s: float) -> float:
        """Realistic F1 speed curve around Bahrain circuit (in km/h)."""
        s = s % track_length
        # DRS Straights
        if s < 3000 or s > 50000:
            return 315.0  # Main straight
        elif 9000 <= s <= 14000:
            return 295.0  # Straight between T3 and T4
        elif 25000 <= s <= 29500:
            return 290.0  # Back straight T10-T11
        # Slow corners
        elif 3500 <= s <= 6500:
            return 105.0  # Turns 1-2-3 complex
        elif 14500 <= s <= 17000:
            return 115.0  # Turn 4
        elif 22500 <= s <= 24500:
            return 95.0  # Turn 8 hairpin / Turn 9-10
        elif 47000 <= s <= 49500:
            return 120.0  # Turns 14-15 onto main straight
        else:
            return 210.0  # Flowing medium-speed sweepers

    # Initial grid offsets along track (decimeters behind start/finish)
    # Start spread across ~600 dm (60 meters) on the main straight before T1
    initial_offsets = {
        "VER": 52800.0,
        "NOR": 52730.0,
        "LEC": 52660.0,
        "HAM": 52590.0,
        "PIA": 52520.0,
        "SAI": 52450.0,
        "RUS": 52380.0,
        "PER": 52310.0,
        "ALO": 52240.0,
        "STR": 52170.0,
    }

    # Lateral offsets (dm) across track width to simulate racing line & overtaking
    lateral_offsets = {
        "VER": 4.0,
        "NOR": -5.0,
        "LEC": 3.0,
        "HAM": -4.0,
        "PIA": 6.0,
        "SAI": -3.0,
        "RUS": 5.0,
        "PER": -6.0,
        "ALO": 2.0,
        "STR": -5.0,
    }

    # Dynamic pace modifiers creating realistic battles/overtakes over 5 laps
    pace_profiles = {
        "VER": lambda lap, t: 1.000 + 0.008 * math.sin(t * 0.05),
        "NOR": lambda lap, t: 1.004 + 0.012 * math.cos(t * 0.04),  # NOR challenges VER
        "LEC": lambda lap, t: 0.998 + 0.015 * math.sin(t * 0.06),  # LEC aggressive on SOFT
        "HAM": lambda lap, t: 0.995 + 0.007 * math.sin(t * 0.03),
        "PIA": lambda lap, t: 0.994 + 0.014 * math.sin(t * 0.07),  # PIA fast on SOFT
        "SAI": lambda lap, t: 0.988 + 0.006 * math.cos(t * 0.03),  # SAI steady on HARD
        "RUS": lambda lap, t: 0.985 + 0.012 * math.sin(t * 0.05),
        "PER": lambda lap, t: 0.982 + 0.008 * math.cos(t * 0.04),
        "ALO": lambda lap, t: 0.978 + 0.006 * math.sin(t * 0.02),
        "STR": lambda lap, t: 0.972 + 0.005 * math.cos(t * 0.02),
    }

    # Simulation setup
    DT = 0.5
    TOTAL_LAPS = 5
    target_race_dist = TOTAL_LAPS * track_length

    # Current state for each driver: cumulative distance from start line
    driver_total_dist = {}
    for drv in DEMO_DRIVERS:
        abbr = drv.abbreviation
        driver_total_dist[abbr] = initial_offsets[abbr] - track_length

    driver_prev_speed = {drv.abbreviation: 200.0 for drv in DEMO_DRIVERS}

    frames: list[ReplayFrame] = []
    step = 0
    leader_finished_step = None
    COOLDOWN_FRAMES = 8  # 4 seconds after leader takes the chequered flag

    while True:
        t = round(step * DT, 2)
        driver_states = []

        for drv in DEMO_DRIVERS:
            abbr = drv.abbreviation
            tot_dist = driver_total_dist[abbr]
            # Track coordinate s (0 <= s < track_length)
            s_track = tot_dist % track_length
            current_lap = int(tot_dist // track_length) + 1
            current_lap = max(1, min(TOTAL_LAPS, current_lap))

            # Sector calculation based on position along the track
            if s_track < s1_end:
                sec = 1
            elif s_track < s2_end:
                sec = 2
            else:
                sec = 3

            # Speed calculation
            base_spd = get_base_speed(s_track)
            pace_factor = pace_profiles[abbr](current_lap, t)
            target_spd = base_spd * pace_factor

            # Acceleration / deceleration smoothing
            prev_spd = driver_prev_speed[abbr]
            accel_rate = 0.25
            spd = prev_spd + accel_rate * (target_spd - prev_spd)
            driver_prev_speed[abbr] = spd

            # Throttle & Brake
            delta_spd = target_spd - prev_spd
            if delta_spd < -8.0:
                brake = True
                throttle = 0.0
            else:
                brake = False
                throttle = min(100.0, max(25.0, (spd / 330.0) * 100.0))

            # Gear selection
            if spd < 105:
                gear = 2
            elif spd < 145:
                gear = 3
            elif spd < 185:
                gear = 4
            elif spd < 230:
                gear = 5
            elif spd < 275:
                gear = 6
            elif spd < 305:
                gear = 7
            else:
                gear = 8

            # RPM calculation
            rpm = 9000.0 + (spd / 330.0) * 2800.0 + (throttle / 100.0) * 400.0

            # DRS: Active (12) in straight DRS zones when speed > 270 km/h; 0 elsewhere
            is_drs_zone = (s_track < 3000 or s_track > 50500) or (9500 <= s_track <= 13500) or (25500 <= s_track <= 29000)
            drs = 12 if is_drs_zone and spd > 265.0 else 0

            # Coordinate calculation along polyline + lateral offset
            cx, cy, tangent = get_track_point(s_track)
            lat = lateral_offsets[abbr]
            # Normal vector (-sin, cos)
            nx = -math.sin(tangent)
            ny = math.cos(tangent)
            final_x = round(cx + lat * nx, 2)
            final_y = round(cy + lat * ny, 2)

            driver_states.append({
                "abbr": abbr,
                "tot_dist": tot_dist,
                "x": final_x,
                "y": final_y,
                "speed": round(spd, 1),
                "gear": gear,
                "throttle": round(throttle, 1),
                "brake": brake,
                "rpm": round(rpm, 1),
                "drs": drs,
                "tyre": DRIVER_TYRES[abbr],
                "lap": current_lap,
                "sector": sec,
            })

            # Advance distance for next step: speed (km/h) -> dm/s (* 10/3.6) * DT
            speed_dm_s = spd * (10.0 / 3.6)
            driver_total_dist[abbr] += speed_dm_s * DT

        # Determine race positions by ordering strictly by total distance traveled (descending)
        driver_states.sort(key=lambda item: item["tot_dist"], reverse=True)

        drivers_in_frame: list[DriverFrame] = []
        for rank_idx, state in enumerate(driver_states):
            drivers_in_frame.append(
                DriverFrame(
                    driver_id=state["abbr"],
                    x=state["x"],
                    y=state["y"],
                    speed=state["speed"],
                    gear=state["gear"],
                    throttle=state["throttle"],
                    brake=state["brake"],
                    rpm=state["rpm"],
                    drs=state["drs"],
                    tyre=state["tyre"],
                    lap=state["lap"],
                    sector=state["sector"],
                    position=rank_idx + 1,  # Strictly 1..10
                )
            )

        # Leader's lap defines the overall frame lap
        frame_lap = driver_states[0]["lap"]
        frames.append(ReplayFrame(timestamp=t, lap=frame_lap, drivers=drivers_in_frame))

        # Check if leader has crossed the finish line to complete the 5th lap
        if driver_states[0]["tot_dist"] >= target_race_dist:
            if leader_finished_step is None:
                leader_finished_step = step
            elif step >= leader_finished_step + COOLDOWN_FRAMES:
                break

        step += 1

    replay_data = ReplayData(
        frames=frames,
        min_time=0.0,
        max_time=round(frames[-1].timestamp, 2),
    )

    info = SessionInfo(
        year=2024,
        event="Demo Grand Prix",
        session_name="Demo Race (Bahrain GP Sample)",
        session_type="R",
        total_laps=TOTAL_LAPS,
        is_demo=True,
    )

    processed_session = ProcessedSession(
        info=info,
        drivers=DEMO_DRIVERS,
        circuit=orig.circuit,
        replay_data=replay_data,
    )

    return processed_session


if __name__ == "__main__":
    ps = build_demo_replay()
    print("Generated demo replay:")
    print("  Drivers:", [d.abbreviation for d in ps.drivers])
    print("  Total laps declared:", ps.info.total_laps)
    print("  Frame count:", len(ps.replay_data.frames))
    print("  Duration:", ps.replay_data.max_time)

    # Audit checks
    observed_laps = set(f.lap for f in ps.replay_data.frames)
    print("  Observed frame laps:", sorted(list(observed_laps)))

    observed_sectors = set(d.sector for f in ps.replay_data.frames for d in f.drivers)
    print("  Observed sectors:", sorted(list(observed_sectors)))

    observed_positions = set(d.position for f in ps.replay_data.frames for d in f.drivers)
    print("  Observed positions:", sorted(list(observed_positions)))

    observed_drs = set(d.drs for f in ps.replay_data.frames for d in f.drivers)
    print("  Observed DRS codes:", sorted(list(observed_drs)))

    observed_tyres = set(d.tyre for f in ps.replay_data.frames for d in f.drivers)
    print("  Observed tyres:", sorted(list(observed_tyres)))

    # Save to disk
    out_path = "backend/assets/demo/demo_replay.pkl"
    with open(out_path, "wb") as f:
        pickle.dump(ps, f, protocol=pickle.HIGHEST_PROTOCOL)
    print(f"Successfully saved to {out_path} ({os.path.getsize(out_path)} bytes)")
