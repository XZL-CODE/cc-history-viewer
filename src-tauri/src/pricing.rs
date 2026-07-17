//! Conservative API-equivalent model pricing.
//!
//! Rates are USD per million tokens and were checked against the Anthropic and OpenAI model
//! pricing pages on 2026-07-17. Unknown or ambiguous model IDs intentionally return `None`.

use crate::models::{Agent, NormalizedUsage};
use chrono::NaiveDate;

#[derive(Clone, Copy)]
struct Rate {
    model: &'static str,
    input: f64,
    cached_input: f64,
    cache_write: f64,
    output: f64,
    long_context_threshold: Option<u64>,
}

const CLAUDE_RATES: &[Rate] = &[
    rate("claude-fable-5", 10.0, 1.0, 12.5, 50.0),
    rate("claude-opus-4-8", 5.0, 0.5, 6.25, 25.0),
    rate("claude-opus-4-7", 5.0, 0.5, 6.25, 25.0),
    rate("claude-opus-4-6", 5.0, 0.5, 6.25, 25.0),
    rate("claude-opus-4-5", 5.0, 0.5, 6.25, 25.0),
    rate("claude-opus-4-1", 15.0, 1.5, 18.75, 75.0),
    rate("claude-opus-4-0", 15.0, 1.5, 18.75, 75.0),
    // Date snapshots such as claude-opus-4-20250514 represent Opus 4.0.
    rate("claude-opus-4-20", 15.0, 1.5, 18.75, 75.0),
    rate("claude-sonnet-5", 2.0, 0.2, 2.5, 10.0),
    rate("claude-sonnet-4-6", 3.0, 0.3, 3.75, 15.0),
    rate("claude-sonnet-4-5", 3.0, 0.3, 3.75, 15.0),
    rate("claude-sonnet-4-0", 3.0, 0.3, 3.75, 15.0),
    rate("claude-sonnet-4-20", 3.0, 0.3, 3.75, 15.0),
    rate("claude-3-7-sonnet", 3.0, 0.3, 3.75, 15.0),
    rate("claude-3-5-sonnet", 3.0, 0.3, 3.75, 15.0),
    rate("claude-haiku-4-5", 1.0, 0.1, 1.25, 5.0),
    rate("claude-3-5-haiku", 0.8, 0.08, 1.0, 4.0),
    rate("claude-3-haiku", 0.25, 0.025, 0.3125, 1.25),
];

const CODEX_RATES: &[Rate] = &[
    openai_long("gpt-5.5", 5.0, 0.5, 30.0),
    openai("gpt-5.4-mini", 0.75, 0.075, 4.5),
    openai("gpt-5.4-nano", 0.2, 0.02, 1.25),
    openai_long("gpt-5.4", 2.5, 0.25, 15.0),
    openai("gpt-5.3-codex", 1.75, 0.175, 14.0),
    openai("gpt-5.2-codex", 1.75, 0.175, 14.0),
    openai("gpt-5.2", 1.75, 0.175, 14.0),
    openai("gpt-5.1-codex-max", 1.25, 0.125, 10.0),
    openai("gpt-5.1-codex", 1.25, 0.125, 10.0),
    openai("gpt-5.1", 1.25, 0.125, 10.0),
    openai("gpt-5-codex", 1.25, 0.125, 10.0),
    openai("gpt-5", 1.25, 0.125, 10.0),
    openai("gpt-5-mini", 0.25, 0.025, 2.0),
    openai("o4-mini", 1.1, 0.275, 4.4),
    openai("gpt-4.1", 2.0, 0.5, 8.0),
];

const fn rate(
    model: &'static str,
    input: f64,
    cached_input: f64,
    cache_write: f64,
    output: f64,
) -> Rate {
    Rate {
        model,
        input,
        cached_input,
        cache_write,
        output,
        long_context_threshold: None,
    }
}

const fn openai(model: &'static str, input: f64, cached_input: f64, output: f64) -> Rate {
    rate(model, input, cached_input, input * 1.25, output)
}

const fn openai_long(model: &'static str, input: f64, cached_input: f64, output: f64) -> Rate {
    Rate {
        long_context_threshold: Some(272_000),
        ..openai(model, input, cached_input, output)
    }
}

fn is_snapshot_or_exact(model: &str, base: &str) -> bool {
    if model == base {
        return true;
    }
    model
        .strip_prefix(base)
        .and_then(|suffix| suffix.strip_prefix('-'))
        .is_some_and(|suffix| {
            let (shape_matches, format) = match suffix.as_bytes() {
                bytes if bytes.len() == 8 && bytes.iter().all(u8::is_ascii_digit) => {
                    (true, "%Y%m%d")
                }
                bytes
                    if bytes.len() == 10
                        && bytes[4] == b'-'
                        && bytes[7] == b'-'
                        && bytes.iter().enumerate().all(|(index, byte)| {
                            [4, 7].contains(&index) || byte.is_ascii_digit()
                        }) =>
                {
                    (true, "%Y-%m-%d")
                }
                _ => (false, ""),
            };
            shape_matches && NaiveDate::parse_from_str(suffix, format).is_ok()
        })
}

fn lookup(agent: Agent, model: &str) -> Option<Rate> {
    let rates = match agent {
        Agent::Claude => CLAUDE_RATES,
        Agent::Codex => CODEX_RATES,
    };
    rates
        .iter()
        .copied()
        .filter(|rate| {
            if agent == Agent::Claude {
                model.starts_with(rate.model)
            } else {
                is_snapshot_or_exact(model, rate.model)
            }
        })
        .max_by_key(|rate| rate.model.len())
}

/// Estimate standard API-equivalent cost. It is not a Claude/Codex subscription charge.
pub fn estimate_cost(agent: Agent, model: &str, usage: NormalizedUsage) -> Option<f64> {
    let rate = lookup(agent, model)?;
    let input_total = usage.uncached_input.saturating_add(usage.cache_read);
    let long_context = rate
        .long_context_threshold
        .is_some_and(|threshold| input_total > threshold);
    let input_multiplier = if long_context { 2.0 } else { 1.0 };
    let output_multiplier = if long_context { 1.5 } else { 1.0 };
    Some(
        (usage.uncached_input as f64 * rate.input * input_multiplier
            + usage.cache_read as f64 * rate.cached_input * input_multiplier
            + usage.cache_creation as f64 * rate.cache_write * input_multiplier
            + usage.output as f64 * rate.output * output_multiplier)
            / 1_000_000.0,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn usage(input: u64, cached: u64, creation: u64, output: u64) -> NormalizedUsage {
        NormalizedUsage {
            uncached_input: input,
            cache_read: cached,
            cache_creation: creation,
            output,
            reasoning_output: output / 2,
        }
    }

    #[test]
    fn claude_cache_rates_are_accounted_separately() {
        let cost = estimate_cost(
            Agent::Claude,
            "claude-sonnet-4-5-20250929",
            usage(1_000_000, 1_000_000, 1_000_000, 1_000_000),
        )
        .unwrap();
        assert!((cost - 22.05).abs() < 1e-9);
    }

    #[test]
    fn codex_cached_input_is_not_charged_as_uncached_again() {
        let cost = estimate_cost(
            Agent::Codex,
            "gpt-5.3-codex",
            usage(600_000, 400_000, 0, 200_000),
        )
        .unwrap();
        assert!((cost - (1.05 + 0.07 + 2.8)).abs() < 1e-9);
    }

    #[test]
    fn codex_long_context_multiplier_is_applied_when_observable() {
        let cost = estimate_cost(Agent::Codex, "gpt-5.4", usage(300_000, 0, 0, 100_000)).unwrap();
        assert!((cost - 3.75).abs() < 1e-9);
    }

    #[test]
    fn mini_and_nano_do_not_get_a_long_context_surcharge() {
        let mini =
            estimate_cost(Agent::Codex, "gpt-5.4-mini", usage(300_000, 0, 0, 100_000)).unwrap();
        let nano =
            estimate_cost(Agent::Codex, "gpt-5.4-nano", usage(300_000, 0, 0, 100_000)).unwrap();
        assert!((mini - 0.675).abs() < 1e-9);
        assert!((nano - 0.185).abs() < 1e-9);
    }

    #[test]
    fn newly_supported_official_codex_rates_are_priced() {
        let gpt_55 = estimate_cost(Agent::Codex, "gpt-5.5", usage(300_000, 0, 0, 100_000)).unwrap();
        let codex_max = estimate_cost(
            Agent::Codex,
            "gpt-5.1-codex-max",
            usage(1_000_000, 0, 0, 1_000_000),
        )
        .unwrap();
        let o4_mini =
            estimate_cost(Agent::Codex, "o4-mini", usage(1_000_000, 0, 0, 1_000_000)).unwrap();
        let gpt_41 =
            estimate_cost(Agent::Codex, "gpt-4.1", usage(1_000_000, 0, 0, 1_000_000)).unwrap();
        assert!((gpt_55 - 7.5).abs() < 1e-9);
        assert!((codex_max - 11.25).abs() < 1e-9);
        assert!((o4_mini - 5.5).abs() < 1e-9);
        assert!((gpt_41 - 10.0).abs() < 1e-9);
    }

    #[test]
    fn codex_snapshots_require_an_exact_supported_date_suffix() {
        for model in [
            "gpt-5.1-codex-max",
            "gpt-5.1-codex-max-20260717",
            "gpt-5.1-codex-max-2026-07-17",
        ] {
            assert!(estimate_cost(Agent::Codex, model, usage(100, 0, 0, 100)).is_some());
        }

        for model in [
            "gpt-5.1-codex-max-preview",
            "gpt-5.1-codex-max-202607",
            "gpt-5.1-codex-max-2026717",
            "gpt-5.1-codex-max-2026-7-17",
            "gpt-5.1-codex-max-2026-02-30",
            "gpt-5.1-codex-max-20260717-preview",
        ] {
            assert!(estimate_cost(Agent::Codex, model, usage(100, 0, 0, 100)).is_none());
        }
    }

    #[test]
    fn ambiguous_or_unknown_models_are_not_priced() {
        assert!(estimate_cost(Agent::Codex, "gpt-5.6-sol", usage(100, 0, 0, 100)).is_none());
        assert!(estimate_cost(Agent::Claude, "unknown-model", usage(100, 0, 0, 100)).is_none());
    }
}
