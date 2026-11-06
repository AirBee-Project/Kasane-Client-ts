//! spatial-id-rs の `SpatialIdSet` と `SpatialIdMap` を JS から使えるようにする。
//!
//! 空間 ID は数値列でやりとりする。
//! - 受け取る ID と、RangeId で返す ID: `[z, f0, f1, x0, x1, y0, y1, i, t0, t1]`
//! - FlexId で返す ID: `[fz, f, xz, x, yz, y, tz, t]`
//!
//! 複数の ID を返すときは、1つ分の数値列を連ねる。

use js_sys::{Array, Float64Array};
use spatial_id::collection::{SpatialIdMap as Map, SpatialIdSet as Set};
use spatial_id::{FlexId, RangeId};
use wasm_bindgen::prelude::*;

fn decode(id: &[f64]) -> Result<RangeId, JsError> {
    let &[z, f0, f1, x0, x1, y0, y1, i, t0, t1] = id else {
        return Err(JsError::new("a spatial id must have 10 numbers"));
    };
    RangeId::new(
        z as u8,
        [f0 as i32, f1 as i32],
        [x0 as u32, x1 as u32],
        [y0 as u32, y1 as u32],
    )
    .and_then(|id| id.time_with(i as u64, [t0 as u64, t1 as u64]))
    .map_err(|e| JsError::new(&e.to_string()))
}

trait Encode {
    fn encode(self, out: &mut Vec<f64>);
}

impl Encode for RangeId {
    fn encode(self, out: &mut Vec<f64>) {
        let [f0, f1] = self.f();
        let [x0, x1] = self.x();
        let [y0, y1] = self.y();
        let [t0, t1] = self.t();
        out.extend([
            self.z().into(),
            f0.into(),
            f1.into(),
            x0.into(),
            x1.into(),
            y0.into(),
            y1.into(),
            self.i().seconds() as f64,
            t0 as f64,
            t1 as f64,
        ]);
    }
}

impl Encode for FlexId {
    fn encode(self, out: &mut Vec<f64>) {
        out.extend([
            self.f_zoomlevel().into(),
            self.f_index().into(),
            self.x_zoomlevel().into(),
            self.x_index().into(),
            self.y_zoomlevel().into(),
            self.y_index().into(),
            self.t_zoomlevel().into(),
            self.t_index() as f64,
        ]);
    }
}

fn encode_ids(ids: impl Iterator<Item = impl Encode>) -> Vec<f64> {
    let mut out = Vec::new();
    ids.for_each(|id| id.encode(&mut out));
    out
}

/// `[ID の数値列, 値の配列]` を返す。
fn encode_entries<V: AsRef<JsValue>>(entries: impl Iterator<Item = (impl Encode, V)>) -> Array {
    let mut ids = Vec::new();
    let values = Array::new();
    for (id, value) in entries {
        id.encode(&mut ids);
        values.push(value.as_ref());
    }
    Array::of2(&Float64Array::from(ids.as_slice()), &values)
}

#[wasm_bindgen]
#[derive(Default)]
pub struct SpatialIdSet(Set);

#[wasm_bindgen]
impl SpatialIdSet {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&mut self, id: &[f64]) -> Result<(), JsError> {
        self.0.insert(decode(id)?);
        Ok(())
    }

    pub fn get(&self, id: &[f64]) -> Result<Vec<f64>, JsError> {
        Ok(encode_ids(self.0.get(decode(id)?)))
    }

    pub fn remove(&mut self, id: &[f64]) -> Result<Vec<f64>, JsError> {
        Ok(encode_ids(self.0.remove(decode(id)?)))
    }

    #[wasm_bindgen(js_name = getFlexIds)]
    pub fn get_flex_ids(&self, id: &[f64]) -> Result<Vec<f64>, JsError> {
        Ok(encode_ids(self.0.get_flex_ids(decode(id)?)))
    }

    #[wasm_bindgen(js_name = removeFlexIds)]
    pub fn remove_flex_ids(&mut self, id: &[f64]) -> Result<Vec<f64>, JsError> {
        Ok(encode_ids(self.0.remove_flex_ids(decode(id)?)))
    }

    pub fn union(&self, other: &SpatialIdSet) -> SpatialIdSet {
        Self(&self.0 | &other.0)
    }

    pub fn intersection(&self, other: &SpatialIdSet) -> SpatialIdSet {
        Self(&self.0 & &other.0)
    }

    pub fn difference(&self, other: &SpatialIdSet) -> SpatialIdSet {
        Self(&self.0 - &other.0)
    }

    pub fn count(&self) -> usize {
        self.0.count()
    }

    #[wasm_bindgen(js_name = isEmpty)]
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    pub fn clear(&mut self) {
        self.0.clear();
    }

    pub fn ids(&self) -> Vec<f64> {
        encode_ids(self.0.iter())
    }

    #[wasm_bindgen(js_name = flexIds)]
    pub fn flex_ids(&self) -> Vec<f64> {
        encode_ids(self.0.iter_flex_ids())
    }
}

/// 値は JS の `===` で比べる（`JsValue` の `PartialEq`）。
#[wasm_bindgen]
#[derive(Default)]
pub struct SpatialIdMap(Map<JsValue>);

#[wasm_bindgen]
impl SpatialIdMap {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(
        &mut self,
        id: &[f64],
        #[wasm_bindgen(unchecked_param_type = "unknown")] value: JsValue,
    ) -> Result<(), JsError> {
        self.0.insert(decode(id)?, value);
        Ok(())
    }

    #[wasm_bindgen(unchecked_return_type = "[Float64Array, unknown[]]")]
    pub fn get(&self, id: &[f64]) -> Result<Array, JsError> {
        Ok(encode_entries(self.0.get(decode(id)?)))
    }

    #[wasm_bindgen(unchecked_return_type = "[Float64Array, unknown[]]")]
    pub fn remove(&mut self, id: &[f64]) -> Result<Array, JsError> {
        Ok(encode_entries(self.0.remove(decode(id)?)))
    }

    #[wasm_bindgen(js_name = getFlexIds, unchecked_return_type = "[Float64Array, unknown[]]")]
    pub fn get_flex_ids(&self, id: &[f64]) -> Result<Array, JsError> {
        Ok(encode_entries(self.0.get_flex_ids(decode(id)?)))
    }

    #[wasm_bindgen(js_name = removeFlexIds, unchecked_return_type = "[Float64Array, unknown[]]")]
    pub fn remove_flex_ids(&mut self, id: &[f64]) -> Result<Array, JsError> {
        Ok(encode_entries(self.0.remove_flex_ids(decode(id)?)))
    }

    pub fn union(&self, other: &SpatialIdMap) -> SpatialIdMap {
        Self(self.0.union(&other.0))
    }

    pub fn intersection(&self, other: &SpatialIdMap) -> SpatialIdMap {
        Self(self.0.intersection(&other.0))
    }

    pub fn difference(&self, other: &SpatialIdMap) -> SpatialIdMap {
        Self(self.0.difference(&other.0))
    }

    pub fn count(&self) -> usize {
        self.0.count()
    }

    #[wasm_bindgen(js_name = isEmpty)]
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    pub fn clear(&mut self) {
        self.0.clear();
    }

    #[wasm_bindgen(unchecked_return_type = "[Float64Array, unknown[]]")]
    pub fn entries(&self) -> Array {
        encode_entries(self.0.iter())
    }

    #[wasm_bindgen(js_name = flexEntries, unchecked_return_type = "[Float64Array, unknown[]]")]
    pub fn flex_entries(&self) -> Array {
        encode_entries(self.0.iter_flex_ids())
    }
}
