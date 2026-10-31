"""Periodically pulls admin-editable thresholds from apps/api's /settings/internal, so changing
them in the dashboard's Pengaturan page takes effect without restarting detection-engine.

Falls back to the static .env-configured defaults (app.config.settings) whenever apps/api is
unreachable or hasn't been asked yet — a settings-sync hiccup should never stop detection, just
leave it on whatever thresholds were last known good.
"""

import asyncio
import logging

import httpx

from app.config import settings as static_settings

logger = logging.getLogger("settings_sync")

_SYNC_INTERVAL_SECONDS = 15.0

_cached: dict = {
    "detectionReportThreshold": static_settings.cctv_report_threshold,
    "detectionMatchThreshold": static_settings.match_threshold,
}


def get_report_threshold() -> float:
    return _cached["detectionReportThreshold"]


def get_match_threshold() -> float:
    return _cached["detectionMatchThreshold"]


async def _settings_base_url() -> str:
    # express_webhook_url looks like "http://localhost:4000/detections/webhook" — the settings
    # endpoint lives on the same Express app, just a different route.
    url = static_settings.express_webhook_url
    origin = url.split("/detections/webhook")[0]
    return f"{origin}/settings/internal"


async def _sync_once(client: httpx.AsyncClient) -> None:
    try:
        res = await client.get(
            await _settings_base_url(),
            headers={"X-Internal-Api-Key": static_settings.internal_api_key},
            timeout=5.0,
        )
        res.raise_for_status()
        data = res.json()
        _cached["detectionReportThreshold"] = float(data["detectionReportThreshold"])
        _cached["detectionMatchThreshold"] = float(data["detectionMatchThreshold"])
    except Exception as err:  # noqa: BLE001 — any failure here just means "keep last known good"
        logger.warning("Gagal sinkron pengaturan dari apps/api, pakai nilai terakhir: %s", err)


async def run_settings_sync_loop() -> None:
    async with httpx.AsyncClient() as client:
        while True:
            await _sync_once(client)
            await asyncio.sleep(_SYNC_INTERVAL_SECONDS)
