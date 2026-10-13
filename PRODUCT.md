# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: React, TypeScript, and a small Node.js service; selected for a full-stack engineering showcase that can run locally.

## Users

The primary audience is software engineers evaluating an unfamiliar repository and engineers preparing to explain a codebase or change to another person. This project should also demonstrate full-stack engineering skills to recruiters.

## Product Purpose

Stxic Atlas analyzes repository history and structure to help someone understand a proposed change: what it touches, what is historically coupled to it, and what evidence supports the impact assessment. Its optional AI change review compares a local Git diff with user-provided change intent and recent commit context, then asks local-model specialist reviewers to find concrete risks and a skeptical chair to challenge them.

## Positioning

Unlike a commit browser or an architecture map alone, Stxic Atlas combines structural relationships with historical co-change evidence to make a proposed change's likely blast radius inspectable and explainable.

## Operating Context

The application is intended to run locally against a repository. A clearly labeled synthetic example will be available so a reviewer can explore the interface without providing a repository.

## Capabilities and Constraints

- The project is a local-first web application with a React and TypeScript frontend and a Node.js service.
- Repository findings should be derived from inspectable evidence and distinguish analysis from inference.
- The demonstration must not imply that synthetic sample repository data is real.
- The impact map works without an external account, API key, or cloud service. AI review requires an optional Ollama service and model running locally.
- Local review feedback is stored in SQLite outside the scanned repository; it adjusts bounded agent weights from explicit human ratings.
- User-provided repositories and private code must remain local in the intended product design.

## Evidence on Hand

The workspace was empty when work began. No production repository, customer data, performance measurements, testimonials, or external deployment is provided. The initial experience will use explicitly labeled synthetic demonstration data.

## Product Principles

- Show the evidence behind each conclusion.
- Make impact understandable without hiding the underlying files and history.
- Keep repository analysis local by default.
- Distinguish measured signals from inferred risk.
- Label user-provided intent, Git metadata, deterministic facts, and model interpretations separately.
- Make the first visit useful even without importing a repository.
