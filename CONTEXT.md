# Job Lighthouse

Users track companies. A runner scrapes their openings. An LLM scores each job against the user's profile.

## Language

**Company**:
An employer the user watches, through exactly one source.
_Avoid_: Employer, account

**Paused company**:
A Company that runs skip. Its row and jobs are kept.
_Avoid_: Inactive, disabled

**Run**:
One scrape pass over Companies. Its scope is every active Company, or a single Company.
_Avoid_: Job, sync

**Run banner**:
A short status message about a Run the user started. A "running" banner lasts as long as the Run does.
_Avoid_: Toast, alert

**Filters**:
The Config fields that cut irrelevant postings at scrape time: include keywords, exclude keywords, and location.
_Avoid_: Search settings

**Include keywords / Exclude keywords**:
Words a posting must contain / must not contain. Exclude matches whole words only.

**Company link**:
The Company's name, linking to its `website_url` in a new tab. There is no in-app company page.
_Avoid_: Company page
