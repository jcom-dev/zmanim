// File: email_service.go
// Purpose: Email sending via SMTP - invitations, notifications, publisher requests
// Pattern: service
// Dependencies: net/smtp, email templates
// Frequency: high - used by 6 handlers
// Compliance: Check docs/adr/ for pattern rationale

package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"text/template"
)

// EmailService handles sending transactional emails via Resend
type EmailService struct {
	apiKey  string
	from    string
	domain  string
	webURL  string
	client  *http.Client
	enabled bool
}

// EmailTemplate represents the available email templates
type EmailTemplate string

const (
	TemplatePublisherInvitation      EmailTemplate = "publisher-invitation"
	TemplatePublisherApproved        EmailTemplate = "publisher-approved"
	TemplatePublisherRejected        EmailTemplate = "publisher-rejected"
	TemplatePasswordReset            EmailTemplate = "password-reset"
	TemplateWelcome                  EmailTemplate = "welcome"
	TemplatePublisherRequestReceived EmailTemplate = "publisher-request-received"
	TemplateAdminNewRequest          EmailTemplate = "admin-new-request"
	TemplatePublisherCreated         EmailTemplate = "publisher-created"
	TemplateUserAddedToAdmin         EmailTemplate = "user-added-admin"
	TemplateUserAddedToPublisher     EmailTemplate = "user-added-publisher"
	TemplatePasswordResetRequest     EmailTemplate = "password-reset-request"
	TemplateZmanRequestApproved      EmailTemplate = "zman-request-approved"
	TemplateZmanRequestRejected      EmailTemplate = "zman-request-rejected"
	TemplateCorrectionApproved       EmailTemplate = "correction-approved"
	TemplateCorrectionRejected       EmailTemplate = "correction-rejected"
)

// SendEmailRequest represents the Resend API request
type SendEmailRequest struct {
	From    string     `json:"from"`
	To      []string   `json:"to"`
	Subject string     `json:"subject"`
	HTML    string     `json:"html,omitempty"`
	Text    string     `json:"text,omitempty"`
	Tags    []EmailTag `json:"tags,omitempty"`
}

// EmailTag represents a tag for email categorization
type EmailTag struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// NewEmailService creates a new EmailService instance
func NewEmailService() *EmailService {
	apiKey := os.Getenv("RESEND_API_KEY")
	from := os.Getenv("RESEND_FROM")
	domain := os.Getenv("RESEND_DOMAIN")
	webURL := os.Getenv("WEB_URL")

	if webURL == "" {
		webURL = "http://localhost:3001"
	}

	enabled := apiKey != "" && from != ""

	if enabled {
		slog.Info("email service initialized", "from", from, "domain", domain)
	} else {
		slog.Warn("email service not configured - emails will be logged but not sent",
			"has_api_key", apiKey != "",
			"has_from", from != "")
	}

	return &EmailService{
		apiKey:  apiKey,
		from:    from,
		domain:  domain,
		webURL:  webURL,
		client:  &http.Client{},
		enabled: enabled,
	}
}

// IsEnabled returns whether the email service is configured
func (s *EmailService) IsEnabled() bool {
	return s.enabled
}

// GetWebURL returns the configured web URL for links in emails
func (s *EmailService) GetWebURL() string {
	return s.webURL
}

// SendInvitation sends a publisher team invitation email
func (s *EmailService) SendInvitation(to, inviterName, publisherName, acceptURL string) error {
	subject := fmt.Sprintf("You've been invited to join %s on Shtetl Zmanim", publisherName)

	data := map[string]string{
		"inviter_name":   inviterName,
		"publisher_name": publisherName,
		"accept_url":     acceptURL,
	}

	html := s.renderTemplate(TemplatePublisherInvitation, data)
	return s.send(to, subject, html, []EmailTag{{Name: "template", Value: string(TemplatePublisherInvitation)}})
}

// SendInvitationExistingUser sends an invitation email to an existing user
func (s *EmailService) SendInvitationExistingUser(to, userName, inviterName, publisherName, role, acceptURL string) error {
	subject := fmt.Sprintf("You've been invited to join %s on Shtetl Zmanim", publisherName)

	data := map[string]string{
		"user_name":      userName,
		"inviter_name":   inviterName,
		"publisher_name": publisherName,
		"role":           role,
		"accept_url":     acceptURL,
	}

	html := s.renderTemplate(TemplatePublisherInvitation, data)
	return s.send(to, subject, html, []EmailTag{{Name: "template", Value: string(TemplatePublisherInvitation)}})
}

// SendInvitationNewUser sends an invitation email to a new user who needs to create an account
func (s *EmailService) SendInvitationNewUser(to, inviterName, publisherName, role, acceptURL string) error {
	subject := fmt.Sprintf("You've been invited to join %s on Shtetl Zmanim", publisherName)

	data := map[string]string{
		"inviter_name":   inviterName,
		"publisher_name": publisherName,
		"role":           role,
		"accept_url":     acceptURL,
	}

	html := s.renderTemplate(TemplatePublisherInvitation, data)
	return s.send(to, subject, html, []EmailTag{{Name: "template", Value: string(TemplatePublisherInvitation)}})
}

// SendPublisherRegistrationVerification sends an email verification link for publisher registration
func (s *EmailService) SendPublisherRegistrationVerification(to, publisherName, verificationURL string) error {
	subject := "Verify your email for Shtetl Zmanim publisher registration"

	data := map[string]string{
		"publisher_name":   publisherName,
		"verification_url": verificationURL,
	}

	html := s.renderTemplate(TemplatePublisherRequestReceived, data)
	return s.send(to, subject, html, []EmailTag{{Name: "template", Value: "publisher-registration-verification"}})
}

// SendPublisherRegistrationApproved sends an approval email to a publisher registrant
func (s *EmailService) SendPublisherRegistrationApproved(to, firstName, publisherName, signInURL string) error {
	subject := fmt.Sprintf("Your publisher registration for %s has been approved!", publisherName)

	data := map[string]string{
		"first_name":     firstName,
		"publisher_name": publisherName,
		"sign_in_url":    signInURL,
		"email":          to,
	}

	html := s.renderTemplate(TemplatePublisherApproved, data)
	return s.send(to, subject, html, []EmailTag{{Name: "template", Value: "publisher-registration-approved"}})
}

// SendPublisherRegistrationRejected sends a rejection email to a publisher registrant
func (s *EmailService) SendPublisherRegistrationRejected(to, firstName, publisherName, reason string) error {
	subject := "Update on your Shtetl Zmanim publisher registration"

	data := map[string]string{
		"first_name":     firstName,
		"publisher_name": publisherName,
		"reason":         reason,
	}

	html := s.renderTemplate(TemplatePublisherRejected, data)
	return s.send(to, subject, html, []EmailTag{{Name: "template", Value: "publisher-registration-rejected"}})
}

// SendPublisherApproved sends a welcome email to a newly approved publisher
func (s *EmailService) SendPublisherApproved(to, publisherName, dashboardURL string) error {
	subject := "Welcome to Shtetl Zmanim - Your Publisher Account is Ready!"

	// Build sign-in URL from dashboard URL
	signInURL := strings.Replace(dashboardURL, "/publisher/dashboard", "/sign-in", 1)

	data := map[string]string{
		"publisher_name": publisherName,
		"dashboard_url":  dashboardURL,
		"sign_in_url":    signInURL,
		"email":          to,
	}

	html := s.renderTemplate(TemplatePublisherApproved, data)
	return s.send(to, subject, html, []EmailTag{{Name: "template", Value: string(TemplatePublisherApproved)}})
}

// SendPublisherRejected sends a rejection notice to a publisher applicant
func (s *EmailService) SendPublisherRejected(to, publisherName, reason string) error {
	subject := "Shtetl Zmanim Publisher Application Update"

	data := map[string]string{
		"publisher_name": publisherName,
		"reason":         reason,
	}

	html := s.renderTemplate(TemplatePublisherRejected, data)
	return s.send(to, subject, html, []EmailTag{{Name: "template", Value: string(TemplatePublisherRejected)}})
}

// SendPasswordReset sends a password reset email
func (s *EmailService) SendPasswordReset(to, resetURL, expiresIn string) error {
	subject := "Reset Your Shtetl Zmanim Password"

	data := map[string]string{
		"reset_url":  resetURL,
		"expires_in": expiresIn,
	}

	html := s.renderTemplate(TemplatePasswordReset, data)
	return s.send(to, subject, html, []EmailTag{{Name: "template", Value: string(TemplatePasswordReset)}})
}

// SendWelcome sends a welcome email to a new user
func (s *EmailService) SendWelcome(to, userName string) error {
	subject := "Welcome to Shtetl Zmanim!"

	data := map[string]string{
		"user_name": userName,
		"web_url":   s.webURL,
	}

	html := s.renderTemplate(TemplateWelcome, data)
	return s.send(to, subject, html, []EmailTag{{Name: "template", Value: string(TemplateWelcome)}})
}

// SendPublisherRequestReceived sends a confirmation email to the applicant
func (s *EmailService) SendPublisherRequestReceived(to, name, organization string) error {
	subject := "We Received Your Publisher Application"

	data := map[string]string{
		"name":         name,
		"organization": organization,
	}

	html := s.renderTemplate(TemplatePublisherRequestReceived, data)
	return s.send(to, subject, html, []EmailTag{{Name: "template", Value: string(TemplatePublisherRequestReceived)}})
}

// SendPublisherCreated notifies the publisher that their account has been created
func (s *EmailService) SendPublisherCreated(to, name, organization string) error {
	subject := fmt.Sprintf("Your Publisher Account Has Been Created - %s", organization)

	data := map[string]string{
		"name":         name,
		"organization": organization,
		"web_url":      s.webURL,
	}

	html := s.renderTemplate(TemplatePublisherCreated, data)
	return s.send(to, subject, html, []EmailTag{{Name: "template", Value: string(TemplatePublisherCreated)}})
}

// SendAdminNewPublisherRequest notifies admins of a new publisher request
func (s *EmailService) SendAdminNewPublisherRequest(to, applicantName, organization, email, description, adminURL string) error {
	subject := fmt.Sprintf("New Publisher Request: %s", organization)

	data := map[string]string{
		"applicant_name": applicantName,
		"organization":   organization,
		"email":          email,
		"description":    description,
		"admin_url":      adminURL,
	}

	html := s.renderTemplate(TemplateAdminNewRequest, data)
	return s.send(to, subject, html, []EmailTag{{Name: "template", Value: string(TemplateAdminNewRequest)}})
}

// SendUserAddedToAdmin notifies a user they've been granted admin access
func (s *EmailService) SendUserAddedToAdmin(to, userName string, isNewUser bool) error {
	subject := "You've been granted admin access to Shtetl Zmanim"

	signInURL := s.webURL + "/sign-in"

	data := map[string]string{
		"user_name":   userName,
		"sign_in_url": signInURL,
		"is_new_user": fmt.Sprintf("%t", isNewUser),
	}

	html := s.renderTemplate(TemplateUserAddedToAdmin, data)
	return s.send(to, subject, html, []EmailTag{{Name: "template", Value: string(TemplateUserAddedToAdmin)}})
}

// SendUserAddedToPublisher notifies a user they've been added to a publisher team
func (s *EmailService) SendUserAddedToPublisher(to, userName, publisherName, addedBy string, isNewUser bool) error {
	subject := fmt.Sprintf("You've been added to %s on Shtetl Zmanim", publisherName)

	signInURL := s.webURL + "/sign-in"

	data := map[string]string{
		"user_name":      userName,
		"publisher_name": publisherName,
		"added_by":       addedBy,
		"sign_in_url":    signInURL,
		"is_new_user":    fmt.Sprintf("%t", isNewUser),
	}

	html := s.renderTemplate(TemplateUserAddedToPublisher, data)
	return s.send(to, subject, html, []EmailTag{{Name: "template", Value: string(TemplateUserAddedToPublisher)}})
}

// SendPasswordResetRequest sends a password reset email triggered by an admin
func (s *EmailService) SendPasswordResetRequest(to, userName, resetURL, expiresIn string) error {
	subject := "Password Reset Requested for Shtetl Zmanim"

	data := map[string]string{
		"user_name":  userName,
		"reset_url":  resetURL,
		"expires_in": expiresIn,
	}

	html := s.renderTemplate(TemplatePasswordResetRequest, data)
	return s.send(to, subject, html, []EmailTag{{Name: "template", Value: string(TemplatePasswordResetRequest)}})
}

// SendZmanRequestApproved sends an approval notification for a zman request
func (s *EmailService) SendZmanRequestApproved(to, publisherName, zmanHebrewName, zmanEnglishName, zmanKey, reviewerNotes string) error {
	subject := fmt.Sprintf("Your Zman Request Has Been Approved - %s", zmanEnglishName)

	data := map[string]string{
		"publisher_name":    publisherName,
		"zman_hebrew_name":  zmanHebrewName,
		"zman_english_name": zmanEnglishName,
		"zman_key":          zmanKey,
		"reviewer_notes":    reviewerNotes,
		"web_url":           s.webURL,
	}

	html := s.renderTemplate(TemplateZmanRequestApproved, data)
	return s.send(to, subject, html, []EmailTag{{Name: "template", Value: string(TemplateZmanRequestApproved)}})
}

// SendZmanRequestRejected sends a rejection notification for a zman request
func (s *EmailService) SendZmanRequestRejected(to, publisherName, zmanHebrewName, zmanEnglishName, zmanKey, reviewerNotes string) error {
	subject := fmt.Sprintf("Your Zman Request Update - %s", zmanEnglishName)

	data := map[string]string{
		"publisher_name":    publisherName,
		"zman_hebrew_name":  zmanHebrewName,
		"zman_english_name": zmanEnglishName,
		"zman_key":          zmanKey,
		"reviewer_notes":    reviewerNotes,
		"web_url":           s.webURL,
	}

	html := s.renderTemplate(TemplateZmanRequestRejected, data)
	return s.send(to, subject, html, []EmailTag{{Name: "template", Value: string(TemplateZmanRequestRejected)}})
}

// SendCorrectionApproved sends an approval notification for a locality correction request
func (s *EmailService) SendCorrectionApproved(to, localityName, reviewNotes string) error {
	subject := fmt.Sprintf("Your correction request for %s was approved", localityName)

	data := map[string]string{
		"locality_name": localityName,
		"review_notes": reviewNotes,
		"web_url":      s.webURL,
	}

	html := s.renderTemplate(TemplateCorrectionApproved, data)
	return s.send(to, subject, html, []EmailTag{{Name: "template", Value: string(TemplateCorrectionApproved)}})
}

// SendCorrectionRejected sends a rejection notification for a locality correction request
func (s *EmailService) SendCorrectionRejected(to, localityName, reviewNotes string) error {
	subject := fmt.Sprintf("Your correction request for %s was not approved", localityName)

	data := map[string]string{
		"locality_name": localityName,
		"review_notes": reviewNotes,
		"web_url":      s.webURL,
	}

	html := s.renderTemplate(TemplateCorrectionRejected, data)
	return s.send(to, subject, html, []EmailTag{{Name: "template", Value: string(TemplateCorrectionRejected)}})
}

// send executes the email send via Resend API
func (s *EmailService) send(to, subject, html string, tags []EmailTag) error {
	// Always log the email for debugging
	slog.Info("email send requested",
		"to", to,
		"subject", subject,
		"enabled", s.enabled)

	if !s.enabled {
		slog.Warn("email service not configured, skipping actual send",
			"to", to,
			"subject", subject)
		return nil
	}

	req := SendEmailRequest{
		From:    s.from,
		To:      []string{to},
		Subject: subject,
		HTML:    html,
		Tags:    tags,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal email request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to create HTTP request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+s.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(httpReq)
	if err != nil {
		slog.Error("failed to send email via Resend", "error", err, "to", to)
		// Non-blocking - log error but don't fail the operation
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		slog.Error("Resend API error", "status", resp.StatusCode, "to", to, "subject", subject)
		// Non-blocking - log error but don't fail the operation
		return nil
	}

	slog.Info("email sent successfully via Resend", "to", to, "subject", subject)
	return nil
}

// renderTemplate renders an email template with the provided data
func (s *EmailService) renderTemplate(templateType EmailTemplate, data map[string]string) string {
	templates := map[EmailTemplate]string{
		TemplatePublisherInvitation: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Join {{.publisher_name}} on Shtetl Zmanim</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Shtetl Zmanim</h1>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1e3a5f; margin-top: 0;">You're Invited!</h2>
        <p>{{.inviter_name}} has invited you to join <strong>{{.publisher_name}}</strong> on Shtetl Zmanim.</p>
        <p>As a team member, you'll be able to help manage the publisher's algorithms and coverage areas.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{.accept_url}}" style="background: #1e3a5f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Accept Invitation</a>
        </div>
        <p style="color: #718096; font-size: 14px;">This invitation will expire in 7 days.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #718096; font-size: 12px;">If you didn't expect this invitation, you can safely ignore this email.</p>
    </div>
</body>
</html>`,

		TemplatePublisherApproved: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Shtetl Zmanim</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Shtetl Zmanim</h1>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1e3a5f; margin-top: 0;">Welcome, {{.publisher_name}}!</h2>
        <p>Great news! Your publisher account has been created and is ready to use.</p>

        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #0369a1; margin-top: 0; font-size: 16px;">How to Sign In</h3>
            <p style="margin-bottom: 15px;">You have two options to sign in:</p>
            <p style="margin: 0 0 10px 0;"><strong>Option 1: Google</strong> (recommended if you have a Google account)</p>
            <ul style="color: #4a5568; margin: 0 0 15px 0; padding-left: 20px;">
                <li>Click "Continue with Google" on the sign-in page</li>
                <li>Make sure to use the same email: <strong>{{.email}}</strong></li>
            </ul>
            <p style="margin: 0 0 10px 0;"><strong>Option 2: Email Magic Link</strong></p>
            <ul style="color: #4a5568; margin: 0; padding-left: 20px;">
                <li>Enter your email on the sign-in page</li>
                <li>Click the link sent to your inbox</li>
            </ul>
        </div>

        <p>Once signed in, you can:</p>
        <ul style="color: #4a5568;">
            <li>Set up your calculation algorithms</li>
            <li>Define your coverage areas</li>
            <li>Invite team members to help manage your account</li>
            <li>Publish your zmanim for your community</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{.sign_in_url}}" style="background: #1e3a5f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Sign In Now</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #718096; font-size: 12px;">Thank you for joining Shtetl Zmanim!</p>
    </div>
</body>
</html>`,

		TemplatePublisherRejected: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shtetl Zmanim Application Update</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Shtetl Zmanim</h1>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1e3a5f; margin-top: 0;">Application Update</h2>
        <p>Dear {{.publisher_name}},</p>
        <p>Thank you for your interest in becoming a publisher on Shtetl Zmanim.</p>
        <p>After reviewing your application, we regret to inform you that we are unable to approve it at this time.</p>
        {{if .reason}}
        <div style="background: #f7fafc; border-left: 4px solid #718096; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #4a5568;"><strong>Reason:</strong> {{.reason}}</p>
        </div>
        {{end}}
        <p>If you believe this decision was made in error or would like to provide additional information, please feel free to reach out to us.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #718096; font-size: 12px;">Thank you for your understanding.</p>
    </div>
</body>
</html>`,

		TemplatePasswordReset: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Shtetl Zmanim</h1>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1e3a5f; margin-top: 0;">Reset Your Password</h2>
        <p>We received a request to reset your password. Click the button below to create a new password.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{.reset_url}}" style="background: #1e3a5f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Reset Password</a>
        </div>
        <p style="color: #e53e3e; font-size: 14px;">This link will expire in {{.expires_in}}.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #718096; font-size: 12px;">If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
    </div>
</body>
</html>`,

		TemplateWelcome: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Shtetl Zmanim</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Shtetl Zmanim</h1>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1e3a5f; margin-top: 0;">Welcome, {{.user_name}}!</h2>
        <p>Thank you for joining Shtetl Zmanim! We're excited to have you.</p>
        <p>With Shtetl Zmanim, you can:</p>
        <ul style="color: #4a5568;">
            <li>Get accurate zmanim calculations for any location</li>
            <li>Choose from trusted publishers in your area</li>
            <li>See the formulas behind each calculation</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{.web_url}}" style="background: #1e3a5f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Get Started</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #718096; font-size: 12px;">Thank you for being part of our community!</p>
    </div>
</body>
</html>`,

		TemplatePublisherRequestReceived: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Application Received</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Shtetl Zmanim</h1>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1e3a5f; margin-top: 0;">Application Received!</h2>
        <p>Dear {{.name}},</p>
        <p>Thank you for applying to become a publisher on Shtetl Zmanim for <strong>{{.organization}}</strong>.</p>
        <p>We have received your application and our team will review it shortly. You will receive an email notification once a decision has been made.</p>
        <div style="background: #f7fafc; border-left: 4px solid #1e3a5f; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #4a5568;"><strong>What happens next?</strong></p>
            <ul style="color: #4a5568; margin: 10px 0;">
                <li>Our team will review your application</li>
                <li>We may reach out if we need additional information</li>
                <li>You'll receive an email with our decision</li>
            </ul>
        </div>
        <p>The review process typically takes 1-3 business days.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #718096; font-size: 12px;">If you have any questions, please reply to this email.</p>
    </div>
</body>
</html>`,

		TemplateAdminNewRequest: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Publisher Request</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #c53030 0%, #9b2c2c 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Shtetl Zmanim Admin</h1>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #c53030; margin-top: 0;">New Publisher Request</h2>
        <p>A new publisher application has been submitted and requires your review.</p>
        <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #718096; width: 120px;">Name:</td>
                    <td style="padding: 8px 0; font-weight: 600;">{{.applicant_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #718096;">Organization:</td>
                    <td style="padding: 8px 0; font-weight: 600;">{{.organization}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #718096;">Email:</td>
                    <td style="padding: 8px 0;"><a href="mailto:{{.email}}" style="color: #1e3a5f;">{{.email}}</a></td>
                </tr>
            </table>
        </div>
        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <p style="margin: 0 0 5px 0; color: #92400e; font-weight: 600;">Description:</p>
            <p style="margin: 0; color: #78350f;">{{.description}}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{.admin_url}}" style="background: #c53030; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Review in Admin Portal</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #718096; font-size: 12px;">This is an automated notification from Shtetl Zmanim.</p>
    </div>
</body>
</html>`,

		TemplatePublisherCreated: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Publisher Account Created</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Shtetl Zmanim</h1>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1e3a5f; margin-top: 0;">Your Publisher Account Has Been Created!</h2>
        <p>Dear {{.name}},</p>
        <p>Great news! A publisher account has been created for <strong>{{.organization}}</strong> on Shtetl Zmanim.</p>
        <p>Your account is currently pending verification. Once verified, you will be able to:</p>
        <ul style="color: #4a5568;">
            <li>Set up your calculation algorithms</li>
            <li>Define your coverage areas</li>
            <li>Invite team members to help manage your account</li>
            <li>Publish your zmanim for your community</li>
        </ul>
        <div style="background: #f7fafc; border-left: 4px solid #1e3a5f; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #4a5568;"><strong>What happens next?</strong></p>
            <p style="margin: 10px 0 0 0; color: #4a5568;">You will receive an email once your account has been verified by our team. This typically takes 1-2 business days.</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{.web_url}}" style="background: #1e3a5f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Visit Shtetl Zmanim</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #718096; font-size: 12px;">If you have any questions, please reply to this email.</p>
    </div>
</body>
</html>`,

		TemplateUserAddedToAdmin: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Access Granted</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #c53030 0%, #9b2c2c 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Shtetl Zmanim Admin</h1>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #c53030; margin-top: 0;">Admin Access Granted</h2>
        <p>Hello {{.user_name}},</p>
        <p>You have been granted <strong>administrator access</strong> to Shtetl Zmanim.</p>
        <p>As an admin, you can:</p>
        <ul style="color: #4a5568;">
            <li>Manage all publishers and their settings</li>
            <li>Approve or reject publisher applications</li>
            <li>Add or remove users from the system</li>
            <li>Configure system-wide settings</li>
        </ul>
        {{if eq .is_new_user "true"}}
        <div style="background: #fff5f5; border-left: 4px solid #c53030; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #c53030;"><strong>Set Up Your Account</strong></p>
            <p style="margin: 10px 0 0 0; color: #742a2a;">Since this is a new account, you'll need to set up your password when you first sign in. Use the "Forgot password?" link or sign in with Google if available.</p>
        </div>
        {{end}}
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{.sign_in_url}}" style="background: #c53030; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Sign In to Admin Panel</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #718096; font-size: 12px;">If you did not expect this access, please contact support immediately.</p>
    </div>
</body>
</html>`,

		TemplateUserAddedToPublisher: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Added to Publisher Team</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Shtetl Zmanim</h1>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1e3a5f; margin-top: 0;">Welcome to the Team!</h2>
        <p>Hello {{.user_name}},</p>
        <p>{{.added_by}} has added you to <strong>{{.publisher_name}}</strong> on Shtetl Zmanim.</p>
        <p>As a team member, you can:</p>
        <ul style="color: #4a5568;">
            <li>Manage the publisher's calculation algorithms</li>
            <li>Configure coverage areas</li>
            <li>View analytics and activity logs</li>
            <li>Add other team members</li>
        </ul>
        {{if eq .is_new_user "true"}}
        <div style="background: #f0f9ff; border-left: 4px solid #0369a1; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #0369a1;"><strong>Set Up Your Account</strong></p>
            <p style="margin: 10px 0 0 0; color: #0c4a6e;">Since this is a new account, you'll need to set up your password when you first sign in. Use the "Forgot password?" link or sign in with Google if available.</p>
        </div>
        {{end}}
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{.sign_in_url}}" style="background: #1e3a5f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Sign In Now</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #718096; font-size: 12px;">If you did not expect to be added to this team, please contact the person who added you.</p>
    </div>
</body>
</html>`,

		TemplatePasswordResetRequest: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Requested</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Shtetl Zmanim</h1>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1e3a5f; margin-top: 0;">Password Reset Requested</h2>
        <p>Hello {{.user_name}},</p>
        <p>An administrator has requested a password reset for your Shtetl Zmanim account.</p>
        <p>Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{.reset_url}}" style="background: #1e3a5f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Reset Password</a>
        </div>
        <p style="color: #e53e3e; font-size: 14px;">This link will expire in {{.expires_in}}.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #718096; font-size: 12px;">If you did not expect this password reset, please contact support.</p>
    </div>
</body>
</html>`,

		TemplateZmanRequestApproved: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zman Request Approved</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Shtetl Zmanim</h1>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #059669; margin-top: 0;">Your Zman Request Has Been Approved!</h2>
        <p>Great news! Your request to add a new zman to the registry has been approved.</p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #6b7280; width: 140px;">Hebrew Name:</td>
                    <td style="padding: 8px 0; font-weight: 600;" dir="rtl">{{.zman_hebrew_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">English Name:</td>
                    <td style="padding: 8px 0; font-weight: 600;">{{.zman_english_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Zman Key:</td>
                    <td style="padding: 8px 0; font-family: monospace; background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">{{.zman_key}}</td>
                </tr>
            </table>
        </div>
        {{if .reviewer_notes}}
        <div style="background: #f7fafc; border-left: 4px solid #059669; padding: 15px; margin: 20px 0;">
            <p style="margin: 0 0 5px 0; color: #4a5568; font-weight: 600;">Reviewer Notes:</p>
            <p style="margin: 0; color: #4a5568;">{{.reviewer_notes}}</p>
        </div>
        {{end}}
        <p>The new zman is now available in the registry. You can use it in your formulas with the DSL reference: <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">@{{.zman_key}}</code></p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{.web_url}}/publisher/algorithm" style="background: #059669; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Go to Algorithm Editor</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #718096; font-size: 12px;">Thank you for contributing to the Shtetl Zmanim registry!</p>
    </div>
</body>
</html>`,

		TemplateZmanRequestRejected: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zman Request Update</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Shtetl Zmanim</h1>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1e3a5f; margin-top: 0;">Zman Request Update</h2>
        <p>Thank you for your request to add a new zman to the registry. After review, we were unable to approve it at this time.</p>
        <div style="background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #6b7280; width: 140px;">Hebrew Name:</td>
                    <td style="padding: 8px 0; font-weight: 600;" dir="rtl">{{.zman_hebrew_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">English Name:</td>
                    <td style="padding: 8px 0; font-weight: 600;">{{.zman_english_name}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Requested Key:</td>
                    <td style="padding: 8px 0; font-family: monospace;">{{.zman_key}}</td>
                </tr>
            </table>
        </div>
        {{if .reviewer_notes}}
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
            <p style="margin: 0 0 5px 0; color: #991b1b; font-weight: 600;">Reason:</p>
            <p style="margin: 0; color: #7f1d1d;">{{.reviewer_notes}}</p>
        </div>
        {{end}}
        <p>If you believe this decision was made in error or would like to discuss this further, please reach out to us.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{.web_url}}/publisher/dashboard" style="background: #1e3a5f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Go to Dashboard</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #718096; font-size: 12px;">Thank you for your understanding.</p>
    </div>
</body>
</html>`,

		TemplateCorrectionApproved: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Correction Request Approved</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Shtetl Zmanim</h1>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #059669; margin-top: 0;">Your Correction Request Was Approved!</h2>
        <p>Great news! Your correction request for <strong>{{.locality_name}}</strong> has been approved and the global locality data has been updated.</p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0; color: #166534; font-weight: 600;">Impact</p>
            <p style="margin: 10px 0 0 0; color: #166534;">This correction now benefits all users who use this locality for their zmanim calculations. Thank you for helping improve the accuracy of our data!</p>
        </div>
        {{if .review_notes}}
        <div style="background: #f7fafc; border-left: 4px solid #059669; padding: 15px; margin: 20px 0;">
            <p style="margin: 0 0 5px 0; color: #4a5568; font-weight: 600;">Reviewer Notes:</p>
            <p style="margin: 0; color: #4a5568;">{{.review_notes}}</p>
        </div>
        {{end}}
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{.web_url}}/publisher/correction-requests" style="background: #059669; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">View Your Requests</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #718096; font-size: 12px;">Thank you for contributing to the Shtetl Zmanim community!</p>
    </div>
</body>
</html>`,

		TemplateCorrectionRejected: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Correction Request Update</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Shtetl Zmanim</h1>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1e3a5f; margin-top: 0;">Correction Request Update</h2>
        <p>Thank you for your correction request for <strong>{{.locality_name}}</strong>. After review, we were unable to approve it at this time.</p>
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
            <p style="margin: 0 0 5px 0; color: #991b1b; font-weight: 600;">Reason:</p>
            <p style="margin: 0; color: #7f1d1d;">{{.review_notes}}</p>
        </div>
        <p>If you believe this decision was made in error or have additional evidence to support your correction, please feel free to submit a new request with more details.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{.web_url}}/publisher/correction-requests" style="background: #1e3a5f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">View Your Requests</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #718096; font-size: 12px;">Thank you for your understanding and for helping improve Shtetl Zmanim.</p>
    </div>
</body>
</html>`,
	}

	templateStr, ok := templates[templateType]
	if !ok {
		slog.Warn("unknown email template", "template", templateType)
		return fmt.Sprintf("<html><body><p>Template: %s</p></body></html>", templateType)
	}

	tmpl, err := template.New("email").Parse(templateStr)
	if err != nil {
		slog.Error("failed to parse email template", "error", err, "template", templateType)
		return templateStr
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		slog.Error("failed to execute email template", "error", err, "template", templateType)
		return templateStr
	}

	return buf.String()
}
