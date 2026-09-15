#!/usr/bin/env python3
"""
Generates the offduty trial lifecycle emails from one shared shell.

Five near-identical emails by hand means a template fix has to be applied five
times and will eventually drift. Edit the shell or COPY below and re-run:

    python3 build.py

Then paste each file's contents into the matching email step in MailerLite
(automation "offduty - trial lifecycle (30 day)"). MailerLite may rewrite parts
of the markup, so always send yourself a test before activating.
"""

from pathlib import Path

OUT = Path(__file__).parent

# Brand values are taken from the live site, not invented:
# violet #A78BFA (primary CTA), text #161616, muted #4D4D4D, border #E5E7EB,
# tint #F5F3FF. The wordmark is Helvetica 700 at a 1.5x mark-to-text ratio,
# matching the nav lockup on offduty.me.
SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"

SHELL = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>
  /* Most clients that matter (Gmail, Apple Mail, iOS) honour these.
     Clients that ignore them still get the 600px desktop layout. */
  @media only screen and (max-width: 620px) {{
    .od-pad {{ padding-left: 24px !important; padding-right: 24px !important; }}
    .od-inner {{ padding-left: 18px !important; padding-right: 18px !important; }}
    .od-btn {{ display: block !important; text-align: center !important; }}
  }}
</style>
</head>
<body style="margin:0; padding:0; background-color:#F7F7F8;">

<!-- preheader: shown in inbox preview, hidden in body -->
<div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
  {preheader}
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F7F7F8;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; max-width:600px; background-color:#ffffff; border:1px solid #E5E7EB; border-radius:16px;">

        <!-- header -->
        <tr>
          <td class="od-pad" style="padding:32px 40px 8px 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle" style="padding-right:12px; line-height:0;">
                  <!-- PNG, not the site's SVG: most clients strip SVG. 120px source shown at 36px for retina. -->
                  <img src="https://offduty.me/favicon.png" width="36" height="36" alt=""
                       style="display:block; width:36px; height:36px; border:0; outline:none; text-decoration:none; border-radius:9px;">
                </td>
                <!-- Matches the live lockup: Helvetica 700, letter-spacing normal, and a
                     1.5x mark-to-text ratio, which is where 3 of the 4 lockups on
                     offduty.me sit (the 1.33x hero is the display-size outlier). -->
                <td valign="middle" style="font-family:Helvetica,Arial,sans-serif; font-size:24px; font-weight:700; color:#161616; line-height:28px;">
                  offduty
                </td>
              </tr>
            </table>
          </td>
        </tr>
{body}
      </table>

      <!-- footer -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; max-width:600px;">
        <tr>
          <td align="center" style="padding:24px 24px 8px 24px; font-family:{sans}; font-size:13px; line-height:20px; color:#8A8A8A;">
            offduty is made by <a href="https://discoveryco.me" style="color:#8A8A8A; text-decoration:underline;">DiscoveryCo</a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 24px 32px 24px; font-family:{sans}; font-size:13px; line-height:20px; color:#8A8A8A;">
            <a href="{{$unsubscribe}}" style="color:#8A8A8A; text-decoration:underline;">Unsubscribe</a>
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>

</body>
</html>
"""


def intro(paragraphs, last_margin=20):
    """Opening paragraphs, dark body text.

    last_margin tightens to 12 when a bullet panel follows, so the lead-in line
    sits close to the panel it introduces.
    """
    ps = "\n\n".join(
        '            <p style="margin:0 0 %dpx 0;">%s</p>'
        % (20 if i < len(paragraphs) - 1 else last_margin, p)
        for i, p in enumerate(paragraphs)
    )
    return """
        <!-- body -->
        <tr>
          <td class="od-pad" style="padding:16px 40px 8px 40px; font-family:{sans}; font-size:16px; line-height:26px; color:#161616;">

{ps}

          </td>
        </tr>
""".format(sans=SANS, ps=ps)


def bullets(items):
    """Tinted panel of bullets. Last row drops its bottom padding."""
    rows = []
    for i, item in enumerate(items):
        last = i == len(items) - 1
        # Last row carries no bottom padding, and omits the attribute entirely
        # rather than emitting an empty style="".
        pad = "" if last else "padding:0 0 14px 0; "
        text_attr = "" if last else ' style="padding:0 0 14px 0;"'
        rows.append(
            """                    <tr>
                      <td valign="top" width="18" style="%scolor:#A78BFA; font-size:15px; line-height:24px;">&bull;</td>
                      <td%s>%s</td>
                    </tr>"""
            % (pad, text_attr, item)
        )
    return """
        <!-- bullets -->
        <tr>
          <td class="od-pad" style="padding:0 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F5F3FF; border-radius:12px;">
              <tr>
                <td class="od-inner" style="padding:20px 24px; font-family:{sans}; font-size:15px; line-height:24px; color:#4D4D4D;">

                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
{rows}
                  </table>

                </td>
              </tr>
            </table>
          </td>
        </tr>
""".format(sans=SANS, rows="\n".join(rows))


def button(label, href, top_pad=28):
    return """
        <!-- button -->
        <tr>
          <td align="left" class="od-pad" style="padding:{top}px 40px 4px 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="#A78BFA" style="border-radius:12px;">
                  <a href="{href}"
                     style="display:inline-block; padding:14px 28px; font-family:{sans}; font-size:16px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:12px;">
                    {label}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
""".format(sans=SANS, href=href, label=label, top=top_pad)


def closing(paragraphs, top_pad=24):
    ps = "\n".join(
        '            <p style="margin:0%s">%s</p>'
        % (" 0 20px 0;" if i < len(paragraphs) - 1 else ";", p)
        for i, p in enumerate(paragraphs)
    )
    return """
        <!-- closing -->
        <tr>
          <td class="od-pad" style="padding:{top}px 40px 36px 40px; font-family:{sans}; font-size:16px; line-height:26px; color:#161616;">
{ps}
          </td>
        </tr>
""".format(sans=SANS, ps=ps, top=top_pad)


DASHBOARD = "https://app.offduty.me/dashboard"
BILLING = "https://app.offduty.me/billing"

EMAILS = [
    dict(
        filename="01-welcome.html",
        title="You're all set",
        preheader="Your inbox, on your schedule. Here's how to set it up.",
        body=(
            intro([
                "Hi {$name},",
                "offduty is now connected to your Gmail. Once activated, new email gets held quietly and delivered at the times you chose, instead of landing the second it's sent.",
                "Three things worth doing in the first few days:",
            ], last_margin=12)
            + bullets([
                "Check your delivery times actually match your needs, everyone is different so customising helps.",
                "Add anyone who genuinely needs to reach you straight away as a VIP, so they skip the hold.",
                "Add VIP keywords to help with 2FA passwords. I use &ldquo;verify&rdquo;, &ldquo;otp&rdquo; and &ldquo;verification&rdquo;.",
            ])
            + button("Open offduty", DASHBOARD)
            + closing([
                "offduty is yours for 30 days. I hope you find it as life-changing as I did. If you have any questions, reply to this and it comes to me.",
                "Fynn",
            ])
        ),
    ),
    dict(
        filename="02-checkin.html",
        title="How's offduty working out?",
        preheader="Two weeks in. What's working, and what isn't?",
        body=(
            intro([
                "Hi {$name},",
                "You're about halfway through your trial, so I wanted to check in.",
                "If it's working, I'd love to hear what changed. If it isn't, I'd really like to know that too. Reply to this and it comes straight to me.",
                "Four things people often miss:",
            ], last_margin=12)
            + bullets([
                "You can pause holding for a few hours when you're waiting on something specific.",
                "Find changing habits hard but still want the peace? Use do not disturb to block only private hours.",
                "VIP rules let certain senders through immediately.",
                "Your delivery times are yours to set, they don't have to stay on the defaults.",
            ])
            + closing(["Fynn"], top_pad=28)
        ),
    ),
    dict(
        filename="03-ending-soon.html",
        title="Your offduty trial ends in 3 days",
        preheader="After three days, email goes back to arriving whenever it likes.",
        body=(
            intro([
                "Hi {$name},",
                "Your trial ends in three days.",
                "When it does, holding stops. New email will start landing in your inbox the moment it arrives, the way it did before you started.",
                "If the last month felt quieter, here's how to keep it:",
            ])
            + button("Continue with offduty", BILLING, top_pad=4)
            + closing([
                "And if you've decided it isn't for you, everyone's needs are different and that's ok with me. A one line reply telling me why would help me more than you'd think.",
                "Fynn",
            ])
        ),
    ),
    dict(
        filename="04-ended.html",
        title="Your offduty trial has ended",
        preheader="Your held email has been released. Your settings are still here.",
        body=(
            intro([
                "Hi {$name},",
                "Your trial has ended, so offduty has stopped holding your email. Anything that was already being held has been released.",
                "Nothing is gone and your settings are exactly where you left them. If you subscribe, holding can be re-activated.",
                "I hope you had a similar experience to me. It changed the way I work, allowing me to focus more on my clients and truly be able to relax when I'm not working.",
            ])
            + button("Turn offduty back on", BILLING, top_pad=4)
            + closing(["Fynn"])
        ),
    ),
    dict(
        filename="05-winback.html",
        title="Keep your inbox on your schedule",
        preheader="The last one from me about offduty.",
        body=(
            intro([
                "Hi {$name},",
                "Last email from me about this, I promise.",
                "You spent a month with your inbox arriving on your schedule instead of everyone else's. If you've gone back to the old way and haven't missed it, everyone's needs are different so you can ignore this.",
                "If the constant interruptions have crept back in, offduty is still here.",
            ])
            + button("Start holding again", BILLING, top_pad=4)
            + closing(["Fynn"])
        ),
    ),
]


def main():
    for email in EMAILS:
        html = SHELL.format(
            title=email["title"],
            preheader=email["preheader"],
            body=email["body"],
            sans=SANS,
        )
        path = OUT / email["filename"]
        path.write_text(html)
        print("wrote %s (%d bytes)" % (email["filename"], len(html)))


if __name__ == "__main__":
    main()
