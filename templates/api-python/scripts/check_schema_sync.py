#!/usr/bin/env python3
"""Ensure Python Pydantic contract models match packages/contracts JSON Schema."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from app.lib.contracts_models import (
    ApiError,
    AuthSessionResponse,
    AuthUser,
    LoginRequest,
    RegisterRequest,
)

ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = ROOT / "packages" / "contracts" / "schemas" / "contracts.json"


def _inner(def_name: str) -> dict:
    raw = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    block = raw["definitions"][def_name]
    return block["definitions"][def_name]


def _required_props(model_schema: dict) -> tuple[set[str], set[str]]:
    props = set(model_schema.get("properties", {}))
    required = set(model_schema.get("required", []))
    return props, required


def main() -> int:
    checks: list[tuple[str, dict]] = [
        ("ApiError", ApiError.model_json_schema(by_alias=True)),
        ("RegisterRequest", RegisterRequest.model_json_schema(by_alias=True)),
        ("LoginRequest", LoginRequest.model_json_schema(by_alias=True)),
        ("AuthUser", AuthUser.model_json_schema(by_alias=True)),
        ("AuthSessionResponse", AuthSessionResponse.model_json_schema(by_alias=True)),
    ]

    failures: list[str] = []
    for name, pydantic_schema in checks:
        contract = _inner(name)
        c_props, c_required = _required_props(contract)
        # Pydantic nests $defs; compare top-level property names via alias
        p_props = set(pydantic_schema.get("properties", {}))
        p_required = set(pydantic_schema.get("required", []))
        # AuthUser uses alias createdAt
        if name == "AuthUser" and "createdAt" not in p_props and "created_at" in p_props:
            p_props = (p_props - {"created_at"}) | {"createdAt"}
            p_required = (p_required - {"created_at"}) | {"createdAt"}
        if name == "ApiError":
            for snake, camel in (
                ("error_message", "errorMessage"),
                ("error_code", "errorCode"),
                ("error_key", "errorKey"),
            ):
                if snake in p_props:
                    p_props = (p_props - {snake}) | {camel}
                if snake in p_required:
                    p_required = (p_required - {snake}) | {camel}

        if p_props != c_props:
            failures.append(
                f"{name} properties mismatch: pydantic={p_props} contract={c_props}"
            )
        if p_required != c_required:
            failures.append(
                f"{name} required mismatch: pydantic={p_required} contract={c_required}"
            )
        if contract.get("additionalProperties") is False:
            # models use extra=forbid
            pass

    role = _inner("UserRole")
    if role.get("enum") != ["user", "admin"]:
        failures.append(f"UserRole enum mismatch: {role.get('enum')}")

    if failures:
        print("Schema sync failed:")
        for item in failures:
            print(f" - {item}")
        return 1

    print(f"Schema sync OK ({SCHEMA_PATH})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
