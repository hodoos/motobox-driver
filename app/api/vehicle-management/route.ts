import { NextResponse } from "next/server";
import { canUserAccessMenuItem } from "../../../lib/menuVisibility";
import { readMenuVisibilitySettings } from "../../../lib/menuVisibilitySettings";
import {
  createStoredVehicleExpense,
  deleteStoredVehicleExpense,
  listStoredVehicleManagement,
  normalizeVehicleExpenseDeleteInput,
  normalizeVehicleExpenseInput,
  normalizeVehicleExpenseUpdateInput,
  normalizeVehicleProfileInput,
  saveStoredVehicleProfile,
  updateStoredVehicleExpense,
} from "../../../lib/vehicleManagementStorage";
import {
  createSupabaseAdminClient,
  createSupabaseServerAuthClient,
  getSupabaseAdminConfigurationError,
} from "../../../lib/supabaseServer";
import { getKoreanErrorMessage } from "../../../lib/toast";
import type {
  VehicleExpenseDeleteResponse,
  VehicleExpenseMutationResponse,
  VehicleManagementResponse,
  VehicleProfileMutationResponse,
} from "../../../types";

export const dynamic = "force-dynamic";

function createErrorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getAccessToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authorization.slice(7).trim() || null;
}

function getOptionalAdminClient() {
  return getSupabaseAdminConfigurationError() ? null : createSupabaseAdminClient();
}

async function loadMenuVisibilitySettings() {
  try {
    return {
      settings: (await readMenuVisibilitySettings()).settings,
      error: null,
    };
  } catch (readError) {
    return {
      settings: null,
      error: createErrorResponse(
        getKoreanErrorMessage(
          readError instanceof Error ? readError.message : undefined,
          "메뉴 접근 설정을 불러오지 못했습니다."
        ),
        500
      ),
    };
  }
}

async function getAuthorizedUser(request: Request) {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return {
      user: null,
      error: createErrorResponse("로그인이 필요합니다.", 401),
    };
  }

  const authClient = createSupabaseServerAuthClient();
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(accessToken);

  if (error || !user) {
    return {
      user: null,
      error: createErrorResponse(
        getKoreanErrorMessage(error?.message, "세션을 확인할 수 없습니다. 다시 로그인해주세요."),
        401
      ),
    };
  }

  return {
    user,
    error: null,
  };
}

async function ensureDashboardAccess(request: Request) {
  const { user, error } = await getAuthorizedUser(request);

  if (error || !user) {
    return {
      user: null,
      error,
    };
  }

  const { settings, error: settingsError } = await loadMenuVisibilitySettings();

  if (settingsError || !settings) {
    return {
      user: null,
      error: settingsError,
    };
  }

  if (!canUserAccessMenuItem(settings, "dashboard", user)) {
    return {
      user: null,
      error: createErrorResponse("현재 계정은 차량관리에 접근할 수 없습니다.", 403),
    };
  }

  return {
    user,
    error: null,
  };
}

export async function GET(request: Request) {
  const { user, error } = await ensureDashboardAccess(request);

  if (error || !user) {
    return error;
  }

  try {
    const adminClient = getOptionalAdminClient();
    const { profile, expenses, storage } = await listStoredVehicleManagement(adminClient, user.id);

    const responseBody: VehicleManagementResponse = {
      profile,
      expenses,
      storage,
    };

    return NextResponse.json(responseBody);
  } catch (readError) {
    return createErrorResponse(
      getKoreanErrorMessage(
        readError instanceof Error ? readError.message : undefined,
        "차량관리 정보를 불러오지 못했습니다."
      ),
      500
    );
  }
}

export async function PUT(request: Request) {
  const { user, error } = await ensureDashboardAccess(request);

  if (error || !user) {
    return error;
  }

  const payload = normalizeVehicleProfileInput(await request.json().catch(() => null));

  if (!payload) {
    return createErrorResponse("차량 기본정보를 다시 확인해주세요.", 400);
  }

  try {
    const adminClient = getOptionalAdminClient();
    const { profile, storage } = await saveStoredVehicleProfile(adminClient, user.id, payload);

    const responseBody: VehicleProfileMutationResponse = {
      profile,
      storage,
    };

    return NextResponse.json(responseBody);
  } catch (writeError) {
    return createErrorResponse(
      getKoreanErrorMessage(
        writeError instanceof Error ? writeError.message : undefined,
        "차량 기본정보를 저장하지 못했습니다."
      ),
      500
    );
  }
}

export async function POST(request: Request) {
  const { user, error } = await ensureDashboardAccess(request);

  if (error || !user) {
    return error;
  }

  const payload = normalizeVehicleExpenseInput(await request.json().catch(() => null));

  if (!payload) {
    return createErrorResponse("지출 날짜, 항목, 금액을 다시 확인해주세요.", 400);
  }

  try {
    const adminClient = getOptionalAdminClient();
    const { expense, storage } = await createStoredVehicleExpense(adminClient, user.id, payload);

    const responseBody: VehicleExpenseMutationResponse = {
      expense,
      storage,
    };

    return NextResponse.json(responseBody, { status: 201 });
  } catch (writeError) {
    return createErrorResponse(
      getKoreanErrorMessage(
        writeError instanceof Error ? writeError.message : undefined,
        "차량 지출을 저장하지 못했습니다."
      ),
      500
    );
  }
}

export async function DELETE(request: Request) {
  const { user, error } = await ensureDashboardAccess(request);

  if (error || !user) {
    return error;
  }

  const expenseId = normalizeVehicleExpenseDeleteInput(await request.json().catch(() => null));

  if (!expenseId) {
    return createErrorResponse("삭제할 지출 기록을 확인해주세요.", 400);
  }

  try {
    const adminClient = getOptionalAdminClient();
    const { deleted, storage } = await deleteStoredVehicleExpense(adminClient, user.id, expenseId);

    if (!deleted) {
      return createErrorResponse("삭제할 지출 기록을 찾지 못했습니다.", 404);
    }

    const responseBody: VehicleExpenseDeleteResponse = {
      deletedId: expenseId,
      storage,
    };

    return NextResponse.json(responseBody);
  } catch (deleteError) {
    return createErrorResponse(
      getKoreanErrorMessage(
        deleteError instanceof Error ? deleteError.message : undefined,
        "차량 지출을 삭제하지 못했습니다."
      ),
      500
    );
  }
}

export async function PATCH(request: Request) {
  const { user, error } = await ensureDashboardAccess(request);

  if (error || !user) {
    return error;
  }

  const payload = normalizeVehicleExpenseUpdateInput(await request.json().catch(() => null));

  if (!payload) {
    return createErrorResponse("수정할 지출 기록 정보를 다시 확인해주세요.", 400);
  }

  try {
    const adminClient = getOptionalAdminClient();
    const { expense, storage } = await updateStoredVehicleExpense(
      adminClient,
      user.id,
      payload.id,
      payload
    );

    if (!expense) {
      return createErrorResponse("수정할 지출 기록을 찾지 못했습니다.", 404);
    }

    const responseBody: VehicleExpenseMutationResponse = {
      expense,
      storage,
    };

    return NextResponse.json(responseBody);
  } catch (updateError) {
    return createErrorResponse(
      getKoreanErrorMessage(
        updateError instanceof Error ? updateError.message : undefined,
        "차량 지출을 수정하지 못했습니다."
      ),
      500
    );
  }
}