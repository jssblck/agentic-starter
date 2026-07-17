use napi::bindgen_prelude::Result;
use napi_derive::napi;
use todo_parser::{VERSION, parse_todo};

#[napi(js_name = "parseTodoJson")]
pub fn parse_todo_json(input: String) -> Result<String> {
    let parsed = parse_todo(&input).map_err(|error| napi::Error::from_reason(error.to_string()))?;
    serde_json::to_string(&parsed).map_err(|error| {
        napi::Error::from_reason(format!("failed to serialize parsed todo: {error}"))
    })
}

#[napi(js_name = "nativeVersion")]
pub fn native_version() -> String {
    VERSION.to_owned()
}
