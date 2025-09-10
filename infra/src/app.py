import json, os

def handler(event, context):
    return {
        "statusCode": 200,
        "headers": {"content-type": "application/json"},
        "body": json.dumps({
            "ok": True,
            "stage": os.getenv("STAGE", "dev"),
            "path": event.get("rawPath"),
        }),
    }
