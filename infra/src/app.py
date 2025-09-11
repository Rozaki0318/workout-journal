import json, os, time, uuid
import boto3
from decimal import Decimal
from boto3.dynamodb.conditions import Key

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

def _now() -> int:
    return int(time.time())

def handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method")
    raw_path = event.get("rawPath", "")
    route = event.get("requestContext", {}).get("http", {}).get("path", raw_path)
    headers = event.get("headers") or {}
    user_id = headers.get("x-user-id") or "demo"
    pk_user = f"USER#{user_id}"
    
    # /ping
    if method == "GET" and path.endswith("/ping"):
        return _resp(200, {"ok": True, "stage": os.getenv("STAGE","dev"), "path": path})

    # ---- /sessions ----
    if route.endswith("/sessions") and method == "POST":
        body = {}
        if event.get("body"):
            try: body = json.loads(event["body"])
            except: body = {}
        note = (body.get("note") or "").strip()
        created = _now()
        sid = str(uuid.uuid4())[:8]

        # セッション行：作成 & GSI1(ユーザー最新順)
        TABLE.put_item(Item={
            "PK": pk_user,
            "SK": f"SESSION#{sid}",
            "type": "session",
            "sessionId": sid,
            "createdAt": created,
            "lastUpdatedAt": created,
            "setCount": 0,
            "GSI1PK": pk_user,       # セッション一覧（ユーザー最新順）
            "GSI1SK": created
        })
        return _resp(201, {"sessionId": sid, "createdAt": created, "note": note})

    if route.endswith("/sessions") and method == "GET":
        qs = event.get("queryStringParameters") or {}
        limit = int(qs.get("limit", "10"))
        r = TABLE.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1PK").eq(pk_user),
            ScanIndexForward=False,
            Limit=limit
        )
        items = [
            {
                "sessionId": x["sessionId"],
                "createdAt": x["createdAt"],
                "lastUpdatedAt": x.get("lastUpdatedAt", x["createdAt"]),
                "setCount": int(x.get("setCount", 0)),
                "note": x.get("note","")
            }
            for x in r.get("Items", []) if x.get("type") == "session"
        ]
        return _resp(200, {"items": items})

    # ---- /sessions/{sessionId}/sets ----
    # pathParameters は HttpApi では event["pathParameters"] に入る
    path_params = event.get("pathParameters") or {}
    sid = path_params.get("sessionId")

    # POST: セット追加（原子的に連番採番 → セッション集計を更新 → セット行Put）
    if sid and route.endswith(f"/sessions/{sid}/sets") and method == "POST":
        # 入力の取り出し（weight/reps/note）
        body = {}
        if event.get("body"):
            try: body = json.loads(event["body"])
            except: body = {}
        try:
            weight = float(body.get("weight", 0))
            reps = int(body.get("reps", 0))
        except Exception:
            return _resp(400, {"message": "weight(requires number) and reps(requires integer)"})
        note = (body.get("note") or "").strip()
        now = _now()

        # 1) セッションに対して原子更新（存在チェック + setSeq++, setCount++, lastUpdatedAt=set）
        #    - 存在しない場合は ConditionalCheckFailedException で弾く
        try:
            upd = TABLE.update_item(
                Key={"PK": pk_user, "SK": f"SESSION#{sid}"},
                UpdateExpression="ADD setSeq :one, setCount :one SET lastUpdatedAt = :now",
                ConditionExpression="attribute_exists(PK)",
                ExpressionAttributeValues={
                    ":one": Decimal(1),
                    ":now": Decimal(now),
                },
                ReturnValues="ALL_NEW"
            )
        except TABLE.meta.client.exceptions.ConditionalCheckFailedException:
            return _resp(404, {"message": "session not found"})

        # 取得した新しい連番を使う（Decimal → int）
        seq = int(upd["Attributes"].get("setSeq", 0))
        seq_str = f"{seq:03d}"  # 零詰めで並びを安定化

        # 2) セット行をPut（GSI1PKは SESSION#sid で “そのセッション内の時系列” を表現）
        TABLE.put_item(Item={
            "PK": pk_user,
            "SK": f"SET#{sid}#{seq_str}",
            "type": "set",
            "sessionId": sid,
            "seq": seq,
            "weight": Decimal(str(weight)),
            "reps": Decimal(reps),
            "note": note,
            "createdAt": now,
            "GSI1PK": f"SESSION#{sid}",  # セッション内の一覧用
            "GSI1SK": now
        })

        return _resp(201, {"sessionId": sid, "seq": seq, "createdAt": now})

    # GET: セット一覧（そのセッション内、作成の新しい順）
    if sid and route.endswith(f"/sessions/{sid}/sets") and method == "GET":
        qs = event.get("queryStringParameters") or {}
        limit = int(qs.get("limit", "20"))
        try:
            r = TABLE.query(
                IndexName="GSI1",
                KeyConditionExpression="#gpk = :gpk",
                ExpressionAttributeNames={"#gpk": "GSI1PK"},
                ExpressionAttributeValues={":gpk": f"SESSION#{sid}"},
                ScanIndexForward=False,
                Limit=limit
            )
        except Exception as e:
            return _resp(500, {"message": "query failed", "error": str(e)})

        items = []
        for x in r.get("Items", []):
            if x.get("type") != "set":
                continue
            items.append({
                "seq": int(x.get("seq", 0)),
                "weight": float(x.get("weight", 0)),
                "reps": int(x.get("reps", 0)),
                "note": x.get("note",""),
                "createdAt": int(x.get("createdAt", 0)),
            })

        return _resp(200, {"items": items})

    return _resp(404, {"message": "Not Found"})

