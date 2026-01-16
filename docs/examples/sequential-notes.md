# Sequential Notes

Navigate book chapters, daily notes, or any sequential content with next/prev relations. This example shows chain sorting and flat list display.

---

## Goal

Create a sequential navigation system where:

- Notes link to their next/previous items
- Navigation works both directions automatically
- Items stay in sequence order
- Works for books, courses, daily notes, and more

---

## Configuration

### Relations

**Relation: `next`**

| Setting | Value |
|---------|-------|
| Name | `next` |
| Visual direction | Sequential |
| Aliases | Property: `next` |
| Implied | `prev` (reverse) |

**Relation: `prev`**

| Setting | Value |
|---------|-------|
| Name | `prev` |
| Visual direction | Sequential |
| Aliases | Property: `prev` |
| Implied | `next` (reverse) |

### Groups

**Group: "Sequence"**

| Setting | Value |
|---------|-------|
| Name | Reading Order |
| Members | `next` depth 3, `prev` depth 3 |
| Chain sort priority | Primary |
| Display properties | `order` |

---

## Use Case 1: Book Chapters

### Sample Notes

**Chapter 1 - Introduction.md**

```markdown
---
type: chapter
book: "[[My Book]]"
order: 1
next: "[[Chapter 2 - Getting Started]]"
---

# Chapter 1: Introduction

Welcome to the book...
```

**Chapter 2 - Getting Started.md**

```markdown
---
type: chapter
book: "[[My Book]]"
order: 2
next: "[[Chapter 3 - Deep Dive]]"
---

# Chapter 2: Getting Started

Let's begin with the basics...
```

**Chapter 3 - Deep Dive.md**

```markdown
---
type: chapter
book: "[[My Book]]"
order: 3
next: "[[Chapter 4 - Advanced Topics]]"
---

# Chapter 3: Deep Dive

Now we go deeper...
```

### How It Works

When viewing Chapter 2:

```
▼ Reading Order
  prev  Chapter 1 - Introduction    [1]
  next  Chapter 3 - Deep Dive       [3]
```

You see what comes before and after. The `prev` relation is implied—you only added `next` links.

### One-Way Linking

You only need to link in one direction:

```
Chapter 1 --next--> Chapter 2 --next--> Chapter 3
```

Trail implies the reverse:

```
Chapter 1 <--prev-- Chapter 2 <--prev-- Chapter 3
```

---

## Use Case 2: Daily Notes

### Sample Notes

**2024-03-14.md**

```markdown
---
type: daily
next: "[[2024-03-15]]"
---

# Thursday, March 14, 2024

## Tasks
- [ ] Review PR
- [ ] Team meeting
```

**2024-03-15.md**

```markdown
---
type: daily
next: "[[2024-03-16]]"
---

# Friday, March 15, 2024

## Tasks
- [ ] Deploy update
- [ ] Weekly review
```

### Navigation

When viewing March 15:

```
▼ Reading Order
  prev  2024-03-14
  next  2024-03-16
```

Navigate through your daily notes chronologically.

### Automation Tip

Use Templater or another plugin to automatically add:

```markdown
---
prev: "[[<% tp.date.now("YYYY-MM-DD", -1) %>]]"
next: "[[<% tp.date.now("YYYY-MM-DD", 1) %>]]"
---
```

---

## Use Case 3: Course Lessons

### Sample Notes

**Lesson 01 - Setup.md**

```markdown
---
type: lesson
course: "[[Web Development Course]]"
duration: 15
next: "[[Lesson 02 - HTML Basics]]"
---

# Lesson 1: Setup

Install the required tools...
```

### Configuration Enhancement

Add course context:

**Group: "Course"**

| Setting | Value |
|---------|-------|
| Name | Course |
| Members | `course` depth 1 |
| Show conditions | `type` equals `lesson` |

**Group: "Lessons"**

| Setting | Value |
|---------|-------|
| Name | Lesson Navigation |
| Members | `next` depth 2, `prev` depth 2 |
| Display properties | `duration` |

### Result

When viewing a lesson:

```
▼ Course
  course  Web Development Course

▼ Lesson Navigation
  prev  Lesson 01 - Setup          [15]
  next  Lesson 03 - CSS Intro      [20]
```

---

## Chain Sorting

Chain sort keeps sequential items together, even with property sorting.

### Example

Notes with dates and `next`/`prev` relations:

```
Week 1 Day 1 (date: 2024-01-01) → Week 1 Day 2 (date: 2024-01-02) → Week 1 Day 3
Week 2 Day 1 (date: 2024-01-08) → Week 2 Day 2 (date: 2024-01-09)
```

**With chain sort: Primary**

```
▼ Sequence
  Week 1 Day 1
    Week 1 Day 2
      Week 1 Day 3
  Week 2 Day 1
    Week 2 Day 2
```

Chains stay intact.

**Without chain sort**

```
▼ Sequence
  Week 1 Day 1
  Week 1 Day 2
  Week 1 Day 3
  Week 2 Day 1
  Week 2 Day 2
```

Sorted by date, but chain structure lost.

---

## Depth Limits

For long sequences, limit depth:

| Depth | Shows |
|-------|-------|
| 1 | Immediate next/prev only |
| 3 | Up to 3 items in each direction |
| 0 | Entire sequence (can be slow) |

Recommended: depth 2-3 for navigation, depth 0 only for short sequences.

---

## Combining with Hierarchy

Many sequences exist within a hierarchy:

```
Book
├── Part 1
│   ├── Chapter 1 → Chapter 2 → Chapter 3
│   └── ...
├── Part 2
│   ├── Chapter 4 → Chapter 5
│   └── ...
```

### Configuration

Add both hierarchy and sequence relations:

**Relations:**

- `up` (ascending) → book/part container
- `next` (sequential) → next chapter

**Groups:**

1. "Book Context": `up` depth 2
2. "Chapter Navigation": `next`/`prev` depth 1

### Result

When viewing Chapter 2:

```
▼ Book Context
  up  Part 1
    up  My Book

▼ Chapter Navigation
  prev  Chapter 1
  next  Chapter 3
```

Both contexts available.

---

## Tips

### Consistent Linking

Always link the same direction:

```markdown
# Good: Always use 'next'
Chapter 1: next: Chapter 2
Chapter 2: next: Chapter 3

# Avoid: Mixed directions
Chapter 1: next: Chapter 2
Chapter 2: prev: Chapter 1  # Redundant!
```

Trail handles the reverse automatically.

### Finding Broken Chains

A note without `next` or `prev` is an endpoint. Multiple endpoints might indicate a broken chain.

### Circular Sequences

For cyclical content (like days of week), you can create a loop:

```
Monday → Tuesday → Wednesday → ... → Sunday → Monday
```

Trail handles cycles by visiting each note once.

---

## Complete Configuration

**Relations:**

1. `next` (sequential) → implied: `prev` (reverse)
2. `prev` (sequential) → implied: `next` (reverse)

**Groups:**

1. Reading Order: `next` + `prev` depth 3, chain sort: primary, display: `order`
