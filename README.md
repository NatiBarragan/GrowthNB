# Landing Pages Monorepo - Robot.com

This repository contains all landing pages for Robot.com, hosted on Netlify.

## Project Structure

```
landing-de-segmentacion/
├── docs/                                    # Project documentation
│   ├── CLAUDE.md                           # AI assistant instructions
│   ├── context.md                          # Full project specification
│   ├── HUBSPOT-CONFIGURATION-GUIDE.md      # HubSpot setup guide
│   ├── NOTION_BACKUP_SETUP.md             # Notion integration docs
│   ├── PROJECT-REPORT-OCT-2025.md         # Project status report
│   └── agents-tree.yaml                    # Agent configuration
│
├── src/                                     # Source code
│   ├── components/                         # Reusable HTML components
│   │   ├── component-careers-listing.html
│   │   ├── component-contact-form.html
│   │   ├── component-subheadline-cta.html
│   │   ├── component-testimonial-aws.html
│   │   ├── script-careers-button-inline.html
│   │   ├── script-careers-button-mini.html
│   │   └── script-modify-careers-button.html
│   │
│   ├── pages/                              # Complete landing pages
│   │   ├── contact-form/                   # Contact form page
│   │   └── that-day-is-here/              # Main campaign landing page
│   │
│   └── scripts/                            # Utility scripts
│       ├── check-notion-properties.js      # Notion property checker
│       ├── show-exact-property-names.js    # Property name debugger
│       ├── show-status-options.js          # Status options viewer
│       └── test-form-submission.js         # Form submission tester
│
├── emails/                                  # Email campaign templates
│   ├── all-robot-pre_launch-2025.html
│   ├── all-robot-pre_launch-2025_investors.html
│   └── all-robot-launch-2025_investors.html
│
├── netlify/                                 # Netlify functions & config
├── index.html                               # Root landing page
├── package.json                             # Node.js dependencies
└── netlify.toml                            # Netlify configuration
```

## Quick Start

### Installation

```bash
npm install
```

### Local Development

```bash
# Using Python
python3 -m http.server 8000

# Using Node.js http-server
npx http-server

# Using PHP
php -S localhost:8000
```

Then navigate to: `http://localhost:8000/`

### Running Utility Scripts

```bash
# Check Notion properties
node src/scripts/check-notion-properties.js

# Test form submission
node src/scripts/test-form-submission.js

# Show status options
node src/scripts/show-status-options.js

# Show exact property names
node src/scripts/show-exact-property-names.js
```

## Deployment

This repository is deployed to Netlify:
- **Production**: https://lp.robot.com

Each page is accessible via:
- https://lp.robot.com/that-day-is-here/
- https://lp.robot.com/contact-form/
- https://lp.robot.com/nacas/

## Documentation

All project documentation is in the `/docs` folder:

- **CLAUDE.md** - Instructions for AI assistants working on this project
- **context.md** - Complete project specification and requirements
- **HUBSPOT-CONFIGURATION-GUIDE.md** - Step-by-step HubSpot setup
- **NOTION_BACKUP_SETUP.md** - Notion integration configuration
- **PROJECT-REPORT-OCT-2025.md** - Current project status

## Project Overview

This is a pre-launch segmentation landing page project for Robot.com. The goal is to enrich an existing email database by capturing segmentation data through interactive landing pages integrated with HubSpot Marketing Hub.

**Key Features:**
- Multi-step segmentation forms with conditional logic
- HubSpot CRM integration
- Notion backup for form submissions
- Automated email follow-up workflows
- Mobile-optimized responsive design

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_database_id
```

## Adding New Landing Pages

1. Create a new directory in `src/pages/` (e.g., `src/pages/new-campaign/`)
2. Add your `index.html` and related assets
3. Update this README with the new page details
4. Commit and push to deploy

## Contributing

This is a planning and implementation repository. See `/docs/CLAUDE.md` for detailed development guidelines and project context.
