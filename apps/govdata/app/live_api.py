"""Allowlisted runtime access to the public data portal APIs."""
from __future__ import annotations

import json
import logging
import os
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import requests


SUCCESS_CODES = {"0", "00", "000", "200", "OK", "INFO-000", "INFO-00", "INFO-0"}
SERVICE_KEY_NAMES = {"servicekey", "service_key"}
OPERATION_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")
USER_AGENT = "MOBYDICK-GovData/0.1"
DATA = Path(__file__).resolve().parents[1] / "data"
LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class LiveService:
    name: str
    env_name: str
    default_endpoint: str
    default_operation: str | None
    operations: tuple[str, ...]
    required_params: tuple[str, ...]
    format_param: tuple[str, str]


SERVICES: dict[str, LiveService] = {
    "TAGO_STATION": LiveService(
        name="TAGO 버스 정류소 정보",
        env_name="TAGO_STATION",
        default_endpoint="https://apis.data.go.kr/1613000/BusSttnInfoInqireService",
        default_operation="getCtyCodeList",
        operations=("getCrdntPrxmtSttnList", "getSttnNoList", "getSttnThrghRouteList", "getCtyCodeList"),
        required_params=(),
        format_param=("_type", "json"),
    ),
    "TAGO_ROUTE": LiveService(
        name="TAGO 버스 노선 정보",
        env_name="TAGO_ROUTE",
        default_endpoint="https://apis.data.go.kr/1613000/BusRouteInfoInqireService",
        default_operation="getCtyCodeList",
        operations=("getRouteInfoIem", "getRouteNoList", "getRouteAcctoThrghSttnList", "getCtyCodeList"),
        required_params=(),
        format_param=("_type", "json"),
    ),
    "TAGO_BUS_LOCATION": LiveService(
        name="TAGO 버스 위치 정보",
        env_name="TAGO_BUS_LOCATION",
        default_endpoint="https://apis.data.go.kr/1613000/BusLcInfoInqireService",
        default_operation="getCtyCodeList",
        operations=("getRouteAcctoBusLcList", "getRouteAcctoSpcifySttnAccesBusLcInfo", "getCtyCodeList"),
        required_params=(),
        format_param=("_type", "json"),
    ),
    "TAGO_ARRIVAL": LiveService(
        name="TAGO 버스 도착 정보",
        env_name="TAGO_ARRIVAL",
        default_endpoint="https://apis.data.go.kr/1613000/ArvlInfoInqireService",
        default_operation="getCtyCodeList",
        operations=(
            "getSttnAcctoArvlPrearngeInfoList",
            "getSttnAcctoSpcifyRouteBusArvlPrearngeInfoList",
            "getCtyCodeList",
        ),
        required_params=(),
        format_param=("_type", "json"),
    ),
    "NMC_HOSPITAL": LiveService(
        name="국립중앙의료원 병·의원 정보",
        env_name="NMC_HOSPITAL",
        default_endpoint="https://apis.data.go.kr/B552657/HsptlAsembySearchService",
        default_operation="getHsptlMdcncListInfoInqire",
        operations=(
            "getHsptlMdcncListInfoInqire",
            "HsptlAsembySearchService",
            "getHsptlBassInfoInqire",
            "getBabyListInfoInqire",
            "getBabyLcinfoInqire",
            "getHsptlMdcncFullDown",
        ),
        required_params=(),
        format_param=("_type", "json"),
    ),
    "MOIS_POPULATION": LiveService(
        name="행정안전부 행정동별 주민등록 인구",
        env_name="MOIS_POPULATION",
        default_endpoint="https://apis.data.go.kr/1741000/admmSexdAgePpltn",
        default_operation="selectAdmmSexdAgePpltn",
        operations=("selectAdmmSexdAgePpltn",),
        required_params=("admmCd", "srchFrYm", "srchToYm"),
        format_param=("type", "JSON"),
    ),
    "HEAT_SHELTER": LiveService(
        name="공공 무더위쉼터 정보",
        env_name="HEAT_SHELTER",
        default_endpoint="https://api.data.go.kr/openapi/tn_pubr_public_heat_wve_shltr_api",
        default_operation=None,
        operations=(),
        required_params=(),
        format_param=("type", "JSON"),
    ),
}


class LiveApiError(Exception):
    """An expected live API failure safe to show at the HTTP boundary."""

    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


def _endpoint(service: LiveService) -> str:
    return os.environ.get(service.env_name, service.default_endpoint).rstrip("/")


def live_api_catalog() -> list[dict[str, Any]]:
    return [
        {
            "service": service_key,
            "name": service.name,
            "endpoint": _endpoint(service),
            "default_operation": service.default_operation,
            "operations": list(service.operations),
            "required_params": list(service.required_params),
            "format": {service.format_param[0]: service.format_param[1]},
        }
        for service_key, service in SERVICES.items()
    ]


def _parse_xml(text: str) -> Any:
    try:
        root = ET.fromstring(text)
    except ET.ParseError as error:
        raise LiveApiError(f"공공데이터 API의 XML 응답을 해석하지 못했어요: {error}") from error

    def convert(element: ET.Element) -> Any:
        children = list(element)
        if not children:
            return (element.text or "").strip()

        result: dict[str, Any] = {}
        for child in children:
            tag = child.tag.rsplit("}", 1)[-1]
            value = convert(child)
            if tag in result:
                if not isinstance(result[tag], list):
                    result[tag] = [result[tag]]
                result[tag].append(value)
            else:
                result[tag] = value
        return result

    return {root.tag.rsplit("}", 1)[-1]: convert(root)}


def _parse_response(response: requests.Response) -> tuple[Any, str]:
    text = response.content.decode(response.encoding or "utf-8", errors="replace")
    trimmed = text.lstrip()

    if trimmed.startswith("{") or trimmed.startswith("["):
        try:
            return json.loads(trimmed), "json"
        except json.JSONDecodeError as error:
            raise LiveApiError(f"공공데이터 API의 JSON 응답을 해석하지 못했어요: {error}") from error
    if trimmed.startswith("<"):
        return _parse_xml(trimmed), "xml"

    content_type = response.headers.get("content-type", "알 수 없음")
    raise LiveApiError(f"공공데이터 API가 JSON/XML이 아닌 응답을 반환했어요. ({content_type})")


def _error_message(value: Any) -> str | None:
    if not isinstance(value, dict):
        return None

    service_response = value.get("OpenAPI_ServiceResponse")
    if isinstance(service_response, dict):
        header = service_response.get("cmmMsgHeader")
        if isinstance(header, dict):
            code = str(header.get("returnReasonCode", "")).strip()
            message = str(header.get("returnAuthMsg") or header.get("errMsg") or "인증 실패").strip()
            return f"{code}: {message}" if code else message

    response = value.get("response", value)
    header = response.get("header") if isinstance(response, dict) else None
    if not isinstance(header, dict):
        return None

    code = str(header.get("resultCode", "")).strip()
    if not code or code in SUCCESS_CODES:
        return None

    message = str(header.get("resultMsg") or header.get("resultMag") or "공공데이터 API 오류").strip()
    return f"{code}: {message}"


def _find_records(value: Any) -> list[dict[str, Any]]:
    best: list[dict[str, Any]] = []

    if isinstance(value, list):
        if value and all(isinstance(item, dict) for item in value):
            best = value
        for item in value:
            candidate = _find_records(item)
            if len(candidate) > len(best):
                best = candidate
    elif isinstance(value, dict):
        for key, item in value.items():
            if key in {"header", "cmmMsgHeader"}:
                continue
            candidate = _find_records(item)
            if len(candidate) > len(best):
                best = candidate
        if not best and isinstance(value.get("item"), dict):
            best = [value["item"]]

    return best


def _find_total(value: Any) -> int | None:
    if isinstance(value, dict):
        for key, item in value.items():
            if key.lower() in {"totalcount", "total_count", "totalcnt", "total"}:
                try:
                    return int(str(item).replace(",", ""))
                except (TypeError, ValueError):
                    pass
            total = _find_total(item)
            if total is not None:
                return total
    elif isinstance(value, list):
        for item in value:
            total = _find_total(item)
            if total is not None:
                return total
    return None


def _has_key(params: dict[str, Any], name: str) -> bool:
    return any(key.casefold() == name.casefold() for key in params)


def _request(service: LiveService, url: str, params: dict[str, Any]) -> requests.Response:
    decoded_key = os.environ.get("DATA_GO_KR_KEY", "").strip()
    encoded_key = os.environ.get("DATA_GO_KR_KEY_ENCODED", "").strip()
    if not decoded_key and not encoded_key:
        raise LiveApiError("공공데이터포털 인증키가 설정되지 않았어요. FastAPI의 .env를 확인하세요.", 503)

    request_params = dict(params)
    if decoded_key:
        request_params["serviceKey"] = decoded_key
        try:
            return requests.get(
                url,
                params=request_params,
                headers={"User-Agent": USER_AGENT, "Accept": "application/json, application/xml"},
                timeout=float(os.environ.get("LIVE_API_TIMEOUT_SECONDS", "30")),
            )
        except requests.RequestException as error:
            raise LiveApiError(f"공공데이터 API에 연결하지 못했어요: {error}") from error

    query = urlencode(request_params, doseq=True)
    separator = "&" if "?" in url else "?"
    request_url = f"{url}{separator}serviceKey={encoded_key}{('&' + query) if query else ''}"
    try:
        return requests.get(
            request_url,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json, application/xml"},
            timeout=float(os.environ.get("LIVE_API_TIMEOUT_SECONDS", "30")),
        )
    except requests.RequestException as error:
        raise LiveApiError(f"공공데이터 API에 연결하지 못했어요: {error}") from error


def _live_cache_enabled() -> bool:
    return os.environ.get("GOVDATA_LIVE_CACHE_ENABLED", "true").lower() == "true"


def _live_replay_enabled() -> bool:
    return os.environ.get("GOVDATA_LIVE_REPLAY", "false").lower() == "true"


def _snapshot_path(service_name: str, operation: str | None) -> Path:
    cache_dir = Path(os.environ.get("GOVDATA_LIVE_CACHE_DIR", str(DATA / "live_cache")))
    safe_service = re.sub(r"[^A-Za-z0-9_-]", "_", service_name)
    service = SERVICES.get(service_name)
    normalized_operation = operation or (service.default_operation if service is not None else None) or "default"
    safe_operation = re.sub(r"[^A-Za-z0-9_-]", "_", normalized_operation)
    return cache_dir / f"{safe_service}_{safe_operation}.json"


def _save_snapshot(result: dict[str, Any]) -> bool:
    if not _live_cache_enabled():
        return False

    path = _snapshot_path(result["service"], result.get("operation"))
    snapshot = {
        "service": result["service"],
        "operation": result.get("operation"),
        "endpoint": result["endpoint"],
        "payload": result["payload"],
        "status_code": result["status_code"],
        "content_type": result["content_type"],
        "format": result["format"],
        "response": result["response"],
        "records": result["records"],
        "record_count": result["record_count"],
        "total_count": result["total_count"],
        "saved_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(snapshot, ensure_ascii=False), encoding="utf-8")
        temporary.replace(path)
        return True
    except (OSError, TypeError) as error:
        LOGGER.warning("Unable to save live API snapshot: %s", error)
        return False


def _load_snapshot(service_name: str, operation: str | None) -> dict[str, Any] | None:
    path = _snapshot_path(service_name, operation)

    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None

    if not isinstance(value, dict) or value.get("service") != service_name:
        return None

    return {key: value[key] for key in (
        "service", "operation", "endpoint", "payload", "status_code", "content_type", "format",
        "response", "records", "record_count", "total_count",
    ) if key in value}


def _execute_live_api(service_name: str, operation: str | None, payload: dict[str, Any]) -> dict[str, Any]:
    service = SERVICES.get(service_name)
    if service is None:
        raise LiveApiError("지원하지 않는 공공데이터 서비스예요.", 400)

    if any(key.casefold() in SERVICE_KEY_NAMES for key in payload):
        raise LiveApiError("serviceKey는 서버가 관리하므로 payload에 넣을 수 없어요.", 400)

    selected_operation = (operation or service.default_operation or "").strip().strip("/")
    if selected_operation and not OPERATION_PATTERN.fullmatch(selected_operation):
        raise LiveApiError("공공데이터 API 오퍼레이션 이름이 유효하지 않아요.", 400)
    if service.operations and selected_operation not in service.operations:
        raise LiveApiError("해당 서비스에서 허용하지 않는 오퍼레이션이에요.", 400)
    if not service.operations and selected_operation:
        raise LiveApiError("이 서비스는 기본 엔드포인트만 호출할 수 있어요.", 400)

    missing = [name for name in service.required_params if not _has_key(payload, name)]
    if missing:
        raise LiveApiError(f"필수 payload가 빠졌어요: {', '.join(missing)}", 400)

    params = dict(payload)
    if not _has_key(params, service.format_param[0]):
        params[service.format_param[0]] = service.format_param[1]
    if not _has_key(params, "pageNo"):
        params["pageNo"] = 1
    if not _has_key(params, "numOfRows"):
        params["numOfRows"] = 100

    base = _endpoint(service)
    url = f"{base}/{selected_operation}" if selected_operation else base
    response = _request(service, url, params)
    max_bytes = int(os.environ.get("LIVE_API_MAX_RESPONSE_BYTES", str(4 * 1024 * 1024)))
    if len(response.content) > max_bytes:
        raise LiveApiError("공공데이터 API 응답이 허용된 크기를 초과했어요.", 413)
    if not 200 <= response.status_code < 300:
        raise LiveApiError(f"공공데이터 API가 HTTP {response.status_code}를 반환했어요.")

    parsed, response_format = _parse_response(response)
    error = _error_message(parsed)
    if error:
        raise LiveApiError(f"공공데이터 API 요청이 실패했어요: {error}")

    records = _find_records(parsed)
    return {
        "service": service_name,
        "operation": selected_operation or None,
        "endpoint": url,
        "payload": params,
        "status_code": response.status_code,
        "content_type": response.headers.get("content-type", ""),
        "format": response_format,
        "response": parsed,
        "records": records,
        "record_count": len(records),
        "total_count": _find_total(parsed),
    }


def execute_live_api(service_name: str, operation: str | None, payload: dict[str, Any]) -> dict[str, Any]:
    try:
        result = _execute_live_api(service_name, operation, payload)
    except LiveApiError as error:
        if error.status not in {502, 503, 504} or not _live_replay_enabled():
            raise

        snapshot = _load_snapshot(service_name, operation)
        if snapshot is None:
            raise

        return {**snapshot, "source": "snapshot", "replayed_error": str(error)}

    saved = _save_snapshot(result)
    return {
        **result,
        "source": "live",
        "snapshot": {"key": _snapshot_path(service_name, operation).stem, "saved": saved},
    }
