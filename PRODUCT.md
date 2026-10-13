# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: React, TypeScript, and a small Node.js service; selected for a full-stack engineering showcase that can run locally.

## Users

The audience includes developers, project owners, designers, testers, and people deciding whether to approve a software change. They still need a local Git project, but should not need to understand Git terminology to use the main workflow. This project should also demonstrate full-stack engineering skills to recruiters.

## Product Purpose

Stxic Atlas analyzes repository history and structure to help someone understand a proposed change: what it touches, what is historically coupled to it, and what evidence supports the impact assessment. Its optional AI change review compares a local Git diff with user-provided change intent and recent commit context, then asks local-model specialist reviewers to find concrete risks and a skeptical chair to challenge them.

## Positioning

Unlike a commit browser or an architecture map alone, Stxic Atlas combines structural relationships with historical co-change evidence to make a proposed change's likely blast radius inspectable and explainable.

## Operating Context

The application is intended to run locally against a repository. A clearly labeled synthetic example will be available so a reviewer can explore the interface without providing a repository.

The public landing page provides a separate, clearly labeled synthetic map and review walkthrough without installation. Its purpose is to explain the product and guide visitors to local setup. It cannot scan visitor folders or run AI; real repository work stays in the local app.

## Capabilities and Constraints

- The project is a local-first web application with a React and TypeScript frontend and a Node.js service.
- Repository findings should be derived from inspectable evidence and distinguish analysis from inference.
- The demonstration must not imply that synthetic sample repository data is real.
- The impact map works without an external account, API key, or cloud service. AI explanation/review uses local Ollama by default, or explicitly chosen Ollama Cloud with a user-provided API key.
- Local review feedback is stored in SQLite outside the scanned repository; it adjusts bounded agent weights from explicit human ratings.
- Repository scanning remains local. Selected bounded code/context may leave the computer only for an explicitly previewed and confirmed cloud AI action.

## Evidence on Hand

The public landing page is deployed on Vercel; repository analysis and AI review run through the local application. Demonstrations are explicitly synthetic. No customer data, adoption figures, testimonials, or measured user-impact claims are supplied. Dated implementation checks are recorded in [docs/verification.md](docs/verification.md).

## Product Principles

- Show the evidence behind each conclusion.
- Make impact understandable without hiding the underlying files and history.
- Keep repository analysis local by default.
- Distinguish measured signals from inferred risk.
- Label user-provided intent, Git metadata, deterministic facts, and model interpretations separately.
- Make the first visit useful even without importing a repository.


## Approved optional cloud scope

The user approved optional cloud support alongside a simpler explanation workflow. Cloud is an explicit choice, never a fallback. One explanation pass precedes the optional deeper review; it does not imply a security audit or approval. Keys remain in local server memory, and each cloud action requires inspection of its outgoing repository context.


Plain-language guidance defines Git as saved-version history, explains the file map as clues, and keeps optional technical detail inspectable. Scanning supports Flutter/Dart as well as the existing languages. Cloud-account problems must be distinguished from local scan problems and never shown as successful checks.
