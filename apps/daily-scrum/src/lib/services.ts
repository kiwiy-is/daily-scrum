// Naming convention: https://cloud.google.com/apis/design/standard_methods#list

import { createClient } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/database";
import { revalidateTag, unstable_cache } from "next/cache";
import { createAuthClient } from "@/lib/supabase/auth-client";
import { cookies } from "next/headers";

// TODO: Rename file name to 'queries.ts'

export async function getCurrentUser() {
  // TODO: consider wrapping this with unstable_cache
  const authClient = createAuthClient(cookies());
  return await authClient.auth.getUser();
}

export async function listOrgsWhereCurrentUserIsMember() {
  const {
    data: { user },
    error: getCurrentUserError,
  } = await getCurrentUser();

  if (getCurrentUserError) {
    return {
      data: null,
      error: getCurrentUserError,
    };
  }

  if (!user) {
    return {
      data: null,
      error: {
        message: "User not found",
      },
    };
  }

  const client = createClient<Database>();

  return await unstable_cache(
    async () => {
      return client
        .from("orgs")
        .select(
          `
          id: hash_id,
          name,
          members!inner(
            user_id
          )
          `
        )
        .eq("members.user_id", user.id);
    },
    [`orgs-where-current-user-is-member`],
    {
      tags: [`orgs-where-current-user-is-member`],
      revalidate: false,
    }
  )();
}

export async function createOrgWhereCurrentUserIsMember(
  orgValues: Required<
    Pick<Database["public"]["Tables"]["orgs"]["Insert"], "name">
  >
) {
  const {
    data: { user },
    error: getCurrentUserError,
  } = await getCurrentUser();

  if (getCurrentUserError) {
    return {
      data: null,
      error: getCurrentUserError,
    };
  }

  if (!user) {
    return { data: null, error: { message: "User not found" } };
  }

  const client = createClient<Database>();

  const { data: orgs, error: insertOrgError } = await client
    .from("orgs")
    .insert(orgValues)
    .select();

  if (insertOrgError) {
    return { data: null, error: insertOrgError };
  }

  const [org] = orgs;

  if (!org) {
    throw new Error("Organization not found");
  }

  const { error: insertMemberError } = await client.from("members").insert({
    org_id: org.id,
    user_id: user.id,
  });

  if (insertMemberError) {
    return {
      data: null,
      error: insertMemberError,
    };
  }

  revalidateTag(`orgs-where-current-user-is-member`);

  return {
    data: org,
  };
}

export async function initializeOrg(orgId: number) {
  const client = createClient<Database>();

  const {
    data: orgDailyScrumUpdateForms,
    error: insertOrgDailyScrumUpdateFormError,
  } = await client
    .from("daily_scrum_update_forms")
    .insert({
      org_id: orgId,
      description:
        "Answer questions to keep your team updated and work through any challenges together.",
    })
    .select();

  if (insertOrgDailyScrumUpdateFormError) {
    return { error: insertOrgDailyScrumUpdateFormError };
  }

  const orgDailyScrumUpdateForm = orgDailyScrumUpdateForms[0];

  if (!orgDailyScrumUpdateForm) {
    return { error: { message: "Org Daily Scrum Update Form not found" } };
  }

  const { error: insertOrgSettingsError } = await client
    .from("org_settings")
    .insert([
      {
        org_id: orgId,
        attribute_key: "time_zone",
        attribute_value: "America/New_York", // TODO: Get user timezone
      },
      {
        org_id: orgId,
        attribute_key: "selected_daily_scrum_update_form_id",
        attribute_value: String(orgDailyScrumUpdateForm.id),
      },
    ]);

  if (insertOrgSettingsError) {
    return { error: insertOrgSettingsError };
  }

  const { error: insertOrgDailyScrumUpdateQuestionsError } = await client
    .from("daily_scrum_update_questions")
    .insert([
      {
        daily_scrum_update_form_id: orgDailyScrumUpdateForm.id,
        question: "What did I accomplish yesterday?",
        brief_question: "Yesterday's Progress",
        placeholder: "Your accomplishments from yesterday",
        description:
          "Describe a brief summary of completed tasks or milestones from yesterday.",
        is_required: true,
        max_length: 500,
        order: 0,
      },
      {
        daily_scrum_update_form_id: orgDailyScrumUpdateForm.id,
        question: "What will I work on today?",
        brief_question: "Today's Plan",
        placeholder: "Today's tasks and goals",
        description: "Describe your planned tasks or objectives for today.",
        is_required: true,
        max_length: 500,
        order: 1,
      },
      {
        daily_scrum_update_form_id: orgDailyScrumUpdateForm.id,
        question: "Do you have any blockers or impediments?",
        brief_question: "Obstacles",
        placeholder: "Current blockers or challenges",
        description:
          "Describe any current challenges or obstacles impacting your work.",
        is_required: true,
        max_length: 500,
        order: 2,
      },
    ]);

  if (insertOrgDailyScrumUpdateQuestionsError) {
    return { error: insertOrgDailyScrumUpdateQuestionsError };
  }

  return {};
}

export async function getOrgByHashId(hashId: string) {
  const client = createClient<Database>();

  return unstable_cache(
    async () => {
      return client.from("orgs").select("*").eq("hash_id", hashId).single();
    },
    [`org-${hashId}`],
    {
      tags: [`org-${hashId}`],
      revalidate: false,
    }
  )();
}

export async function getOrgSettings(orgId: number) {
  const client = createClient<Database>();

  return unstable_cache(
    async () => {
      return client.from("org_settings").select("*").eq("org_id", orgId);
    },
    [`org-settings-${orgId}`],
    {
      tags: [`org-settings-${orgId}`],
      revalidate: false,
    }
  )();
}

export async function getDailyScrumUpdateFormWithQuestions(formId: number) {
  const client = createClient<Database>();

  return unstable_cache(
    async () => {
      return client
        .from("daily_scrum_update_forms")
        .select("*, dailyScrumUpdateQuestions:daily_scrum_update_questions(*)")
        .eq("id", formId)
        .single();
    },
    [`daily-scrum-update-form-with-questions-${formId}`],
    {
      tags: [`daily-scrum-update-form-with-questions-${formId}`],
      revalidate: false,
    }
  )();
}

export async function getDailyScrumUpdateEntriesCount(
  formId: number,
  date: string
) {
  const {
    data: { user },
    error: getCurrentUserError,
  } = await getCurrentUser();

  if (getCurrentUserError) {
    return {
      count: null,
      error: getCurrentUserError,
    };
  }

  if (!user) {
    return {
      count: null,
      error: {
        message: "User not found",
      },
    };
  }

  const client = createClient<Database>();

  return unstable_cache(
    async () => {
      return client
        .from("daily_scrum_update_entries")
        .select("*", { count: "exact", head: true })
        .eq("daily_scrum_update_form_id", formId)
        .gte("date", date)
        .lte("date", date)
        .eq("submitted_user_id", user.id);
    },
    [`daily-scrum-update-entries-count-${formId}-${date}-${user.id}`],
    {
      tags: [`daily-scrum-update-entries-count-${formId}-${date}-${user.id}`],
      revalidate: false,
    }
  )();
}

export async function createDailyScrumUpdateEntry(
  entryValues: Required<
    Pick<
      Database["public"]["Tables"]["daily_scrum_update_entries"]["Insert"],
      "daily_scrum_update_form_id" | "date" | "time_zone"
    >
  >
) {
  const {
    data: { user },
    error: getCurrentUserError,
  } = await getCurrentUser();

  if (getCurrentUserError) {
    return {
      data: null,
      error: getCurrentUserError,
    };
  }

  if (!user) {
    return {
      data: null,
      error: {
        message: "User not found",
      },
    };
  }

  const client = createClient<Database>();

  const response = await client
    .from("daily_scrum_update_entries")
    .insert({
      ...entryValues,
      submitted_user_id: user.id,
    })
    .select("*")
    .single();

  revalidateTag(
    `daily-scrum-update-entries-count-${entryValues.daily_scrum_update_form_id}-${entryValues.date}-${user.id}`
  );

  return response;
}

export function createDailyScrumUpdateAnswers(
  entryId: number,
  answersValues: Required<
    Pick<
      Database["public"]["Tables"]["daily_scrum_update_answers"]["Insert"],
      "daily_scrum_update_question_id" | "answer"
    >
  >[]
) {
  const client = createClient<Database>();

  return client.from("daily_scrum_update_answers").insert(
    answersValues.map((answer) => ({
      ...answer,
      daily_scrum_update_entry_id: entryId,
    }))
  );
}