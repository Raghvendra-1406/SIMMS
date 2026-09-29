import threading
import time


class TTLCache:
    """
    Small in-process cache for rows that are read on every MQTT
    message but rarely change (rooms, devices).

    Repositories invalidate or refresh entries on every write, so
    within this process the cache never serves a row older than
    the latest write; the TTL only bounds staleness from writes
    made by other processes.

    None (row not found) is never cached.
    """

    def __init__(self, ttl_seconds=60):
        self.ttl_seconds = ttl_seconds
        self._entries = {}
        self._lock = threading.Lock()

    def get(self, key):
        with self._lock:
            entry = self._entries.get(key)

            if entry is None:
                return None

            value, stored_at = entry

            if time.monotonic() - stored_at > self.ttl_seconds:
                del self._entries[key]
                return None

            return value

    def set(self, key, value):
        if value is None:
            return

        with self._lock:
            self._entries[key] = (value, time.monotonic())

    def clear(self):
        with self._lock:
            self._entries.clear()
