/**
 * Velo page code for the Contact page.
 * Destination in the Wix repo:  src/pages/<PageName>.<id>.js
 *
 * Do NOT rename the generated file — Wix matches page code to pages by
 * filename. Paste this body into the file Wix creates for the Contact page.
 */

import { submitEnquiry } from 'backend/contact.web';

$w.onReady(function () {
  $w('#submitButton').onClick(async () => {
    $w('#statusText').text = '';

    const payload = {
      fullName: $w('#inputFullName').value,
      email: $w('#inputEmail').value,
      phone: $w('#inputPhone').value,
      location: $w('#inputLocation').value,
      designation: $w('#inputDesignation').value,
      intent: $w('#radioIntent').value,
      message: $w('#inputMessage').value,
      company: $w('#inputCompany').value, // honeypot, hidden in the editor
    };

    $w('#submitButton').disable();

    try {
      const result = await submitEnquiry(payload);

      if (result.ok) {
        $w('#statusText').text = result.message;
        [
          '#inputFullName', '#inputEmail', '#inputPhone',
          '#inputLocation', '#inputDesignation', '#inputMessage',
        ].forEach((id) => { $w(id).value = ''; });
      } else {
        const first = result.fieldErrors
          ? Object.values(result.fieldErrors)[0]
          : null;
        $w('#statusText').text = first || result.error;
      }
    } catch (err) {
      console.error(err);
      $w('#statusText').text =
        'We could not reach the server. Please try again.';
    } finally {
      $w('#submitButton').enable();
    }
  });
});
