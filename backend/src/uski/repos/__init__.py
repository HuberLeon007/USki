"""Persistence repositories — deep modules behind small interfaces.

Each repo has two adapters: a Supabase-backed one (runtime, service role) and an
in-memory fake (tests). Routers depend on the Protocol via FastAPI `Depends`, so
tests inject the fake without a live database.
"""
