"""Read-only HTTP load scenarios for ManovaFlow's public pages."""

import logging
import re

from locust import HttpUser, between, events, task


def check_page(response, *, status=200, locale=None, direction=None):
    if response.status_code != status:
        response.failure(f"Expected HTTP {status}, got {response.status_code}")
    elif "text/html" not in response.headers.get("Content-Type", "").lower():
        response.failure("Expected an HTML response")
    elif locale and not re.search(
        rf'<html\b[^>]*\blang="{locale}"[^>]*\bdir="{direction}"',
        response.text,
    ):
        response.failure(f"Expected document language {locale} and direction {direction}")
    elif locale and not re.search(r"<h1\b", response.text):
        response.failure("Expected the homepage heading")
    else:
        # An expected 404 is a successful scenario, not a failed request.
        response.success()


class PublicVisitor(HttpUser):
    host = "http://127.0.0.1:3187"
    wait_time = between(1, 3)

    def visit(self, path, **expected):
        with self.client.get(
            path, name=path, catch_response=True, allow_redirects=False, timeout=10
        ) as response:
            check_page(response, **expected)

    @task(6)
    def english_home(self):
        self.visit("/", locale="en", direction="ltr")

    @task(2)
    def french_home(self):
        self.visit("/fr", locale="fr", direction="ltr")

    @task(2)
    def arabic_home(self):
        self.visit("/ar", locale="ar", direction="rtl")

    @task(1)
    def unsupported_locale(self):
        self.visit("/de", status=404)


def acceptance_errors(stats):
    errors = []
    if stats.total.num_requests == 0:
        errors.append("No requests completed")
    if stats.total.fail_ratio > 0.01:
        errors.append("Failure ratio exceeded 1%")
    for path in ("/", "/fr", "/ar", "/de"):
        entry = stats.entries.get((path, "GET"))
        if entry is None or entry.num_requests == 0:
            errors.append(f"Scenario {path} was not exercised")
        elif (entry.get_response_time_percentile(0.95) or 0) > 2000:
            errors.append(f"Scenario {path} p95 exceeded 2000 ms")
    return errors


@events.quitting.add_listener
def enforce_acceptance(environment, **_kwargs):
    errors = acceptance_errors(environment.stats)
    for error in errors:
        logging.error("Load test acceptance: %s", error)
    if errors:
        environment.process_exit_code = 1
