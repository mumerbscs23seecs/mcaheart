# wix/

Velo code for the **Wix Studio + GitHub** path. Nothing in this folder is used
by the Astro build — it exists so the Wix route has real code to paste in
rather than starting from scratch.

Full instructions: [../WIX-STUDIO-SETUP.md](../WIX-STUDIO-SETUP.md)

| File | Destination |
| --- | --- |
| `src/backend/contact.web.js` | `src/backend/contact.web.js` in the Wix repo |
| `src/pages/masterpage.js` | `src/pages/masterpage.js` in the Wix repo |
| `src/pages/contact.js` | paste into the Contact page's generated code file |
| `styles/global.css` | Studio editor → Code panel → global.css (**not** the repo) |

## Before the contact form works

Create a collection named **Enquiries** in the Content Manager:

| Field | Type |
| --- | --- |
| `fullName`, `email`, `phone`, `location`, `designation`, `intent`, `intentLabel`, `message` | Text |
| `submittedAt` | Date & Time |

Then add a Wix Automation on "new item in Enquiries" to email the team. Doing
notification through an Automation is more reliable than sending mail from
Velo backend code.

## Element IDs expected by `src/pages/contact.js`

Set these in the editor's properties panel:

`#inputFullName` `#inputEmail` `#inputPhone` `#inputLocation`
`#inputDesignation` `#radioIntent` `#inputMessage` `#inputCompany` (hidden
honeypot) `#submitButton` `#statusText`
