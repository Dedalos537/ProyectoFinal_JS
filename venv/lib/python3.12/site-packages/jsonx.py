"""
JSONx module
"""

import io
from xml.sax.saxutils import XMLGenerator

__all__ = [
    'dump',
    'dumps',
    # 'load',  # TODO: implement
    # 'loads',  # TODO: implement
]


def _make_attrs(name, root=False):
    attrs = {}

    if name is not None:
        attrs['name'] = name

    if root:
        attrs['xmlns:json'] = "http://www.ibm.com/xmlns/prod/2009/jsonx"
        attrs['xmlns:xsi'] = 'http://www.w3.org/2001/XMLSchema-instance'
        attrs['xsi:schemaLocation'] = \
            "http://www.datapower.com/schemas/json jsonx.xsd"

    return attrs


def _write_item(xg, value, name=None, root=False):

    if isinstance(value, dict):
        xg.startElement('json:object', _make_attrs(name, root))
        for k, v in value.items():
            if not isinstance(k, str):
                raise ValueError("json keys must be strings")
            _write_item(xg, v, name=k)

        xg.endElement('json:object')
        return

    if isinstance(value, (tuple, list)):
        xg.startElement('json:array', _make_attrs(name))
        for child in value:
            _write_item(xg, child)
        xg.endElement('json:array')
        return

    if root:
        raise ValueError("top level must be either an array or object")

    if value is None:
        xg.startElement('json:null', _make_attrs(name))
        xg.endElement('json:null')
        return

    if isinstance(value, str):
        xg.startElement('json:string', _make_attrs(name))
        xg.characters(value)
        xg.endElement('json:string')
        return

    if isinstance(value, bool):
        xg.startElement('json:boolean', {})
        xg.characters('true' if value else 'false')
        xg.endElement('json:boolean')
        return

    if isinstance(value, (int, float)):
        xg.startElement('json:number', _make_attrs(name))
        xg.characters(str(value))
        xg.endElement('json:number')
        return

    raise ValueError("cannot serialize: {!r}".format(value))


def dump(obj, fp):
    xg = XMLGenerator(fp, 'utf-8')
    xg.startDocument()
    _write_item(xg, obj, root=True)
    xg.endDocument()


def dumps(obj):
    fp = io.BytesIO()
    dump(obj, fp)
    return fp.getvalue()
