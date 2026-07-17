use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const VERSION: &str = env!("TODO_STARTER_VERSION");

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Low,
    Normal,
    High,
    Urgent,
}

impl Priority {
    fn parse(value: &str) -> Result<Self, ParseError> {
        match value {
            "low" => Ok(Self::Low),
            "normal" => Ok(Self::Normal),
            "high" => Ok(Self::High),
            "urgent" => Ok(Self::Urgent),
            other => Err(ParseError::UnknownPriority(other.to_owned())),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedTodo {
    pub title: String,
    pub tags: Vec<String>,
    pub context: Option<String>,
    pub priority: Priority,
    pub due_date: Option<String>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ParseError {
    #[error("todo input is empty")]
    EmptyInput,
    #[error("todo title is empty after metadata is removed")]
    EmptyTitle,
    #[error("only one @context token is allowed")]
    MultipleContexts,
    #[error("priority !{0} is not one of low, normal, high, or urgent")]
    UnknownPriority(String),
    #[error("tag tokens must contain a name after #")]
    EmptyTag,
    #[error("due date {0} must use a real-looking YYYY-MM-DD value")]
    InvalidDueDate(String),
}

pub fn parse_todo(input: &str) -> Result<ParsedTodo, ParseError> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(ParseError::EmptyInput);
    }

    let mut title_tokens = Vec::new();
    let mut tags = BTreeSet::new();
    let mut context = None;
    let mut priority = Priority::Normal;
    let mut due_date = None;

    for token in trimmed.split_whitespace() {
        if let Some(tag) = token.strip_prefix('#') {
            if tag.is_empty() {
                return Err(ParseError::EmptyTag);
            }
            tags.insert(tag.to_lowercase());
            continue;
        }

        if let Some(next_context) = token.strip_prefix('@') {
            if next_context.is_empty() {
                title_tokens.push(token);
                continue;
            }
            if context.replace(next_context.to_lowercase()).is_some() {
                return Err(ParseError::MultipleContexts);
            }
            continue;
        }

        if let Some(next_priority) = token.strip_prefix('!') {
            priority = Priority::parse(&next_priority.to_lowercase())?;
            continue;
        }

        if let Some(next_due_date) = token.strip_prefix("due:") {
            validate_date(next_due_date)?;
            due_date = Some(next_due_date.to_owned());
            continue;
        }

        title_tokens.push(token);
    }

    let title = title_tokens.join(" ");
    if title.is_empty() {
        return Err(ParseError::EmptyTitle);
    }

    Ok(ParsedTodo {
        title,
        tags: tags.into_iter().collect(),
        context,
        priority,
        due_date,
    })
}

fn validate_date(value: &str) -> Result<(), ParseError> {
    let mut parts = value.split('-');
    let year = parts.next().and_then(|part| part.parse::<u16>().ok());
    let month = parts.next().and_then(|part| part.parse::<u8>().ok());
    let day = parts.next().and_then(|part| part.parse::<u8>().ok());
    let no_extra_parts = parts.next().is_none();

    let valid = value.len() == 10
        && no_extra_parts
        && year.is_some_and(|year| year >= 1970)
        && month.is_some_and(|month| (1..=12).contains(&month))
        && day.is_some_and(|day| (1..=31).contains(&day));

    if valid {
        Ok(())
    } else {
        Err(ParseError::InvalidDueDate(value.to_owned()))
    }
}

#[cfg(test)]
mod tests {
    use super::{ParseError, ParsedTodo, Priority, parse_todo};

    #[test]
    fn parses_structured_metadata_without_leaking_it_into_the_title() {
        let parsed = parse_todo("Buy oat milk #Errands @Home !high due:2026-08-01")
            .expect("the sample todo should parse");

        assert_eq!(
            parsed,
            ParsedTodo {
                title: "Buy oat milk".to_owned(),
                tags: vec!["errands".to_owned()],
                context: Some("home".to_owned()),
                priority: Priority::High,
                due_date: Some("2026-08-01".to_owned()),
            }
        );
    }

    #[test]
    fn deduplicates_and_sorts_tags_for_stable_output() {
        let parsed = parse_todo("Ship release #work #urgent #work")
            .expect("duplicate tags should still parse");

        assert_eq!(parsed.tags, vec!["urgent", "work"]);
    }

    #[test]
    fn rejects_an_empty_title() {
        assert_eq!(
            parse_todo("#only-metadata !low"),
            Err(ParseError::EmptyTitle)
        );
    }

    #[test]
    fn rejects_multiple_contexts() {
        assert_eq!(
            parse_todo("Write docs @office @home"),
            Err(ParseError::MultipleContexts)
        );
    }
}
