import ssl

from config.settings import (
    MQTT_PASSWORD,
    MQTT_TLS,
    MQTT_USERNAME,
)


def configure_client(client):
    """
    Apply broker credentials and TLS from settings to a paho client.

    Local Mosquitto: no settings needed (plain TCP on 1883).
    Hosted broker (e.g. HiveMQ Cloud): MQTT_TLS=1, port 8883,
    MQTT_USERNAME / MQTT_PASSWORD.
    """

    if MQTT_USERNAME:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

    if MQTT_TLS:
        # System CA bundle: hosted brokers use public certificates.
        client.tls_set(cert_reqs=ssl.CERT_REQUIRED)

    return client
