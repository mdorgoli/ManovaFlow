"""Regression checks for response validation and acceptance gates."""

import unittest
from types import SimpleNamespace
from unittest.mock import Mock

from loadtest.locustfile import (
    PublicVisitor, acceptance_errors, check_page, enforce_acceptance,
)


class ResponseValidationTests(unittest.TestCase):
    def response(self, status=200, body='<html lang="en" dir="ltr"><h1>Home</h1>'):
        return SimpleNamespace(
            status_code=status, text=body, headers={"Content-Type": "text/html; charset=utf-8"},
            failure=Mock(), success=Mock(),
        )

    def test_all_locales(self):
        for locale, direction in (("en", "ltr"), ("fr", "ltr"), ("ar", "rtl")):
            with self.subTest(locale=locale):
                response = self.response(body=f'<html lang="{locale}" dir="{direction}"><h1>Home</h1>')
                check_page(response, locale=locale, direction=direction)
                response.success.assert_called_once()
                response.failure.assert_not_called()

    def test_expected_404_succeeds(self):
        response = self.response(status=404)
        check_page(response, status=404)
        response.success.assert_called_once()

    def test_invalid_responses_fail(self):
        for status, body, content_type in (
            (500, '<html lang="en" dir="ltr"><h1>Error</h1>', "text/html"),
            (302, "redirect", "text/html"),
            (200, '<html lang="fr" dir="ltr"><h1>Home</h1>', "text/html"),
            (200, '<html lang="en" dir="rtl"><h1>Home</h1>', "text/html"),
            (200, '<html lang="en" dir="ltr">', "text/html"),
            (200, '{}', "application/json"),
            (0, '', ""),
        ):
            with self.subTest(status=status, body=body):
                response = self.response(status, body)
                response.headers["Content-Type"] = content_type
                check_page(response, locale="en", direction="ltr")
                response.failure.assert_called_once()
                response.success.assert_not_called()

    def test_tasks_use_read_only_paths_and_response_checks(self):
        user = PublicVisitor.__new__(PublicVisitor)
        user.visit = Mock()
        for method, path, expected in (
            (user.english_home, "/", {"locale": "en", "direction": "ltr"}),
            (user.french_home, "/fr", {"locale": "fr", "direction": "ltr"}),
            (user.arabic_home, "/ar", {"locale": "ar", "direction": "rtl"}),
            (user.unsupported_locale, "/de", {"status": 404}),
        ):
            method()
            user.visit.assert_called_with(path, **expected)


class AcceptanceTests(unittest.TestCase):
    def stats(self, requests=100, failures=0, p95=150):
        return SimpleNamespace(
            total=SimpleNamespace(num_requests=requests, fail_ratio=failures),
            entries={(path, "GET"): SimpleNamespace(
                num_requests=requests, get_response_time_percentile=lambda _p: p95,
            ) for path in ("/", "/fr", "/ar", "/de")},
        )

    def test_healthy_run_passes(self):
        self.assertEqual(acceptance_errors(self.stats()), [])

    def test_exact_limits_pass(self):
        self.assertEqual(acceptance_errors(self.stats(failures=0.01, p95=2000)), [])

    def test_empty_run_fails(self):
        self.assertIn("No requests completed", acceptance_errors(self.stats(requests=0)))

    def test_excess_failures_fail(self):
        self.assertIn("Failure ratio exceeded 1%", acceptance_errors(self.stats(failures=0.02)))

    def test_slow_page_fails(self):
        self.assertEqual(len(acceptance_errors(self.stats(p95=2100))), 4)

    def test_missing_scenario_fails(self):
        stats = self.stats()
        del stats.entries[("/ar", "GET")]
        self.assertIn("Scenario /ar was not exercised", acceptance_errors(stats))

    def test_failed_run_sets_exit_code(self):
        environment = SimpleNamespace(stats=self.stats(failures=0.02), process_exit_code=None)
        enforce_acceptance(environment)
        self.assertEqual(environment.process_exit_code, 1)

    def test_success_preserves_existing_exit_code(self):
        environment = SimpleNamespace(stats=self.stats(), process_exit_code=7)
        enforce_acceptance(environment)
        self.assertEqual(environment.process_exit_code, 7)


if __name__ == "__main__":
    unittest.main()
