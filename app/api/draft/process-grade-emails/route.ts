import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";


type QueueRow = {
  id: number;
  grade_report_id: number;
  recipient_email: string;
  subject: string;
  html_body: string;
  attempts: number;
};


function adminClient() {
  const url =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;


  if (
    !url ||
    !key
  ) {
    throw new Error(
      "Supabase server environment variables are missing."
    );
  }


  return createClient(
    url,
    key,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false,
      },
    }
  );
}


export async function GET(
  request: Request
) {
  try {
    const suppliedSecret =
      request.headers.get(
        "x-gridiron-sync-secret"
      );


    const configuredSecret =
      process.env
        .GRIDIRON_SYNC_SECRET;


    if (
      !configuredSecret ||
      suppliedSecret !==
        configuredSecret
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Unauthorized.",
        },
        {
          status:
            401,
        }
      );
    }


    const resendApiKey =
      process.env
        .RESEND_API_KEY;


    const fromEmail =
      process.env
        .DRAFT_GRADE_FROM_EMAIL ??
      process.env
        .MOCK_DRAFT_GRADE_FROM_EMAIL;


    if (
      !resendApiKey ||
      !fromEmail
    ) {
      throw new Error(
        "Draft grade email is not configured. RESEND_API_KEY and DRAFT_GRADE_FROM_EMAIL are required."
      );
    }


    const admin =
      adminClient();


    const nowIso =
      new Date()
        .toISOString();


    const {
      data,
      error,
    } =
      await admin
        .from(
          "traditional_draft_grade_email_queue"
        )
        .select(`
          id,
          grade_report_id,
          recipient_email,
          subject,
          html_body,
          attempts
        `)
        .in(
          "status",
          [
            "pending",
            "failed",
          ]
        )
        .lte(
          "available_at",
          nowIso
        )
        .lt(
          "attempts",
          5
        )
        .order(
          "id",
          {
            ascending:
              true,
          }
        )
        .limit(
          20
        );


    if (error) {
      throw new Error(
        error.message
      );
    }


    const rows =
      (
        data ??
        []
      ) as QueueRow[];


    let sent =
      0;

    let failed =
      0;


    for (
      const row
      of rows
    ) {
      const nextAttempt =
        Number(
          row.attempts ??
          0
        ) + 1;


      const {
        data:
          claimed,

        error:
          claimError,
      } =
        await admin
          .from(
            "traditional_draft_grade_email_queue"
          )
          .update({
            status:
              "sending",

            attempts:
              nextAttempt,

            last_error:
              null,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            row.id
          )
          .in(
            "status",
            [
              "pending",
              "failed",
            ]
          )
          .select(
            "id"
          )
          .maybeSingle();


      if (
        claimError ||
        !claimed
      ) {
        continue;
      }


      try {
        const response =
          await fetch(
            "https://api.resend.com/emails",
            {
              method:
                "POST",

              headers: {
                Authorization:
                  `Bearer ${resendApiKey}`,

                "Content-Type":
                  "application/json",

                "User-Agent":
                  "Gridiron365/1.0",

                "Idempotency-Key":
                  `traditional-draft-grade-${row.grade_report_id}`,
              },

              body:
                JSON.stringify({
                  from:
                    fromEmail,

                  to: [
                    row.recipient_email,
                  ],

                  subject:
                    row.subject,

                  html:
                    row.html_body,
                }),
            }
          );


        if (
          !response.ok
        ) {
          const body =
            await response.text();


          throw new Error(
            `Resend ${response.status}: ${body}`
          );
        }


        await admin
          .from(
            "traditional_draft_grade_email_queue"
          )
          .update({
            status:
              "sent",

            sent_at:
              new Date()
                .toISOString(),

            last_error:
              null,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            row.id
          );


        sent +=
          1;
      } catch (
        error
      ) {
        failed +=
          1;


        const message =
          error instanceof
            Error
            ? error.message
            : "Unknown draft grade email error.";


        await admin
          .from(
            "traditional_draft_grade_email_queue"
          )
          .update({
            status:
              "failed",

            last_error:
              message,

            available_at:
              new Date(
                Date.now() +
                5 *
                60 *
                1000
              )
                .toISOString(),

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            row.id
          );
      }
    }


    return NextResponse.json({
      success:
        true,

      processed:
        rows.length,

      sent,

      failed,
    });
  } catch (
    error
  ) {
    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof
            Error
            ? error.message
            : "Draft grade email processing failed.",
      },
      {
        status:
          500,
      }
    );
  }
}
