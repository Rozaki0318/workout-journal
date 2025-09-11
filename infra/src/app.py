import json, os, time, uuid
import boto3
from decimal import Decimal

TABLE = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])

def _resp(status, body):
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(body, default=_json_default),
    }

def _json_default(o):
    if isinstance(o, Decimal): return float(o)
    raise TypeError

def handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method")
    path = event.get("rawPath", "")

    # /ping
    if method == "GET" and path.endswith("/ping"):
        return _resp(200, {"ok": True, "stage": os.getenv("STAGE","dev"), "path": path})

    # 仮ユーザー（認証導入まで x-user-id。未指定は demo）
    headers = event.get("headers") or {}
    user_id = headers.get("x-user-id") or "demo"
    pk = f"USER#{user_id}"

    # POST /sessions  { "note": "胸トレ" }
    if method == "POST" and path.endswith("/sessions"):
        body = {}
        if event.get("body"):
            try: body = json.loads(event["body"])
            except: body = {}
        note = (body.get("note") or "").strip()

        now = int(time.time())
        sid = str(uuid.uuid4())[:8]

        # セッション行（最新一覧用にGSI1にも載せる）
        TABLE.put_item(Item={
            "PK": pk,
            "SK": f"SESSION#{sid}",
            "type": "session",
            "sessionId": sid,
            "createdAt": now,
            "note": note,
            "GSI1PK": pk,
            "GSI1SK": now
        })
        return _resp(201, {"sessionId": sid, "createdAt": now, "note": note})

    # GET /sessions?limit=10
    if method == "GET" and path.endswith("/sessions"):
        qs = event.get("queryStringParameters") or {}
        limit = int(qs.get("limit", "10"))

        r = TABLE.query(
            IndexName="GSI1",
            KeyConditionExpression="#gpk = :gpk",
            ExpressionAttributeNames={"#gpk": "GSI1PK"},
            ExpressionAttributeValues={":gpk": pk},
            ScanIndexForward=False,  # 新しい順
            Limit=limit
        )
        items = [
            {"sessionId": x["sessionId"], "createdAt": x["createdAt"], "note": x.get("note","")}
            for x in r.get("Items", []) if x.get("type") == "session"
        ]
        return _resp(200, {"items": items})

    return _resp(404, {"message": "Not Found"})
