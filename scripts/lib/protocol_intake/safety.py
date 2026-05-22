"""Hard safety flags — intake must never publish, bind, or mutate runtime."""

SAFETY = {
    "auto_publish": False,
    "auto_bind": False,
    "runtime_mutation": False,
    "requires_human_approval": True,
}
