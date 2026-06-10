//! 模型定价表与成本估算。
//! 价格为估算，以官方为准；缓存写按 5 分钟档 1.25× 计，缓存读按 0.1× 计。
//! 模型 id 可能带日期后缀（如 claude-sonnet-4-5-20250929），按「最长前缀匹配」查表。

/// 定价表：(模型 id 前缀, input USD/百万 token, output USD/百万 token)
const PRICES: &[(&str, f64, f64)] = &[
    ("claude-fable-5", 10.0, 50.0),
    ("claude-opus-4-8", 5.0, 25.0),
    ("claude-opus-4-7", 5.0, 25.0),
    ("claude-opus-4-6", 5.0, 25.0),
    ("claude-opus-4-5", 5.0, 25.0),
    ("claude-opus-4-1", 15.0, 75.0),
    ("claude-opus-4-2", 15.0, 75.0),
    ("claude-opus-4-0", 15.0, 75.0),
    // claude-opus-4-20250514 这类「4.0 + 日期后缀」靠该前缀压过 claude-opus-4-2
    ("claude-opus-4-20", 15.0, 75.0),
    ("claude-sonnet-4-6", 3.0, 15.0),
    ("claude-sonnet-4-5", 3.0, 15.0),
    ("claude-sonnet-4-0", 3.0, 15.0),
    ("claude-sonnet-4-2", 3.0, 15.0),
    ("claude-3-7-sonnet", 3.0, 15.0),
    ("claude-3-5-sonnet", 3.0, 15.0),
    ("claude-haiku-4-5", 1.0, 5.0),
    ("claude-3-5-haiku", 0.8, 4.0),
    ("claude-3-haiku", 0.25, 1.25),
];

/// 最长前缀匹配查定价；未匹配返回 None。
fn lookup(model: &str) -> Option<(f64, f64)> {
    PRICES
        .iter()
        .filter(|(prefix, _, _)| model.starts_with(prefix))
        .max_by_key(|(prefix, _, _)| prefix.len())
        .map(|(_, p_in, p_out)| (*p_in, *p_out))
}

/// 估算一笔用量的成本（USD）。
/// 公式：(input*P_in + output*P_out + cache_read*0.1*P_in + cache_creation*1.25*P_in) / 1_000_000。
/// 模型未在定价表中时返回 None。
pub fn estimate_cost(
    model: &str,
    input: u64,
    output: u64,
    cache_read: u64,
    cache_creation: u64,
) -> Option<f64> {
    let (p_in, p_out) = lookup(model)?;
    Some(
        (input as f64 * p_in
            + output as f64 * p_out
            + cache_read as f64 * 0.1 * p_in
            + cache_creation as f64 * 1.25 * p_in)
            / 1_000_000.0,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f64, b: f64) -> bool {
        (a - b).abs() < 1e-9
    }

    #[test]
    fn prefix_match_with_date_suffix() {
        // 带日期后缀的 id 仍能命中
        assert!(close(
            estimate_cost("claude-sonnet-4-5-20250929", 1_000_000, 0, 0, 0).unwrap(),
            3.0
        ));
        // claude-opus-4-20250514 是 opus 4.0：最长前缀应命中 claude-opus-4-20（15/75）
        assert!(close(
            estimate_cost("claude-opus-4-20250514", 1_000_000, 0, 0, 0).unwrap(),
            15.0
        ));
        // claude-opus-4-5-xxx 应命中 claude-opus-4-5（5/25），而不是 4-x 系列其他档
        assert!(close(
            estimate_cost("claude-opus-4-5-20251101", 0, 1_000_000, 0, 0).unwrap(),
            25.0
        ));
        assert!(close(
            estimate_cost("claude-fable-5", 1_000_000, 0, 0, 0).unwrap(),
            10.0
        ));
        assert!(close(
            estimate_cost("claude-haiku-4-5-20251001", 0, 1_000_000, 0, 0).unwrap(),
            5.0
        ));
    }

    #[test]
    fn unknown_model_returns_none() {
        assert!(estimate_cost("gpt-4o", 100, 100, 0, 0).is_none());
        assert!(estimate_cost("<synthetic>", 100, 100, 0, 0).is_none());
        assert!(estimate_cost("", 100, 100, 0, 0).is_none());
    }

    #[test]
    fn cost_formula_values() {
        // sonnet 4.5：3/15；cache_read 0.1×P_in；cache_creation 1.25×P_in
        let c = estimate_cost(
            "claude-sonnet-4-5-20250929",
            1_000_000,
            1_000_000,
            1_000_000,
            1_000_000,
        )
        .unwrap();
        // 3 + 15 + 0.3 + 3.75 = 22.05
        assert!(close(c, 22.05));

        // 小数量级：haiku 3.5（0.8/4）
        let c2 = estimate_cost("claude-3-5-haiku-20241022", 500_000, 250_000, 0, 0).unwrap();
        assert!(close(c2, 0.4 + 1.0));
    }
}
