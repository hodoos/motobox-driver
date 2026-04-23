import type { CSSProperties } from "react";
import { formatMoney, toDateString } from "../../lib/format";
import {
  AdditionalWorkItemForm,
  ExpenseItemForm,
  FreshbackRecoveryItemForm,
  ReportForm,
} from "../../types";

const freshbackRecoveryPriceOptions = ["100", "150", "200"] as const;

const compactInputStyle = {
  width: "100%",
  maxWidth: "8rem",
} as CSSProperties;

const inlineInputStyle = {
  width: "100%",
  maxWidth: "100%",
} as CSSProperties;

function createAdditionalWorkItem(): AdditionalWorkItemForm {
  return {
    key: `additional-work-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    unit_price: "",
    delivered_count: "",
    returned_count: "",
    canceled_count: "",
  };
}

function createFreshbackRecoveryItem(
  overrides: Partial<Omit<FreshbackRecoveryItemForm, "key">> = {}
): FreshbackRecoveryItemForm {
  return {
    key: `freshback-recovery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    unit_price: overrides.unit_price ?? "",
    quantity: overrides.quantity ?? "",
  };
}

function createExpenseItem(
  overrides: Partial<Omit<ExpenseItemForm, "key">> = {}
): ExpenseItemForm {
  return {
    key: `expense-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: overrides.description ?? "",
    amount: overrides.amount ?? "",
  };
}

function createDefaultExpenseItems(): ExpenseItemForm[] {
  return [createExpenseItem()];
}

function getNormalizedExpenseItems(items?: ExpenseItemForm[]): ExpenseItemForm[] {
  return items && items.length > 0 ? items : createDefaultExpenseItems();
}

function getNormalizedFreshbackRecoveryItems(
  items?: FreshbackRecoveryItemForm[]
): FreshbackRecoveryItemForm[] {
  return items && items.length > 0 ? items : [createFreshbackRecoveryItem()];
}

function parseDateKey(dateKey: string) {
  const parsed = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function shiftDateKey(dateKey: string, diffDays: number) {
  const parsed = parseDateKey(dateKey);

  if (!parsed) {
    return dateKey;
  }

  parsed.setDate(parsed.getDate() + diffDays);
  return toDateString(parsed);
}

type Props = {
  selectedDate: string;
  minDate: string;
  maxDate: string;
  onDateChange: (dateKey: string) => void;
  reportForm: ReportForm;
  setReportForm: React.Dispatch<React.SetStateAction<ReportForm>>;
  defaultUnitPrice: number;
  handleReportChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  onSave: () => void;
  saving: boolean;
};

export default function TodayQuickCard({
  selectedDate,
  minDate,
  maxDate,
  onDateChange,
  reportForm,
  setReportForm,
  defaultUnitPrice,
  handleReportChange,
  onSave,
  saving,
}: Props) {
  const previousDate = shiftDateKey(selectedDate, -1);
  const nextDate = shiftDateKey(selectedDate, 1);
  const canMoveToPreviousDate = previousDate >= minDate;
  const canMoveToNextDate = nextDate <= maxDate;
  const additionalWorks = reportForm.additional_works ?? [];
  const expenseItems = getNormalizedExpenseItems(reportForm.expense_items);
  const freshbackRecoveryItems = getNormalizedFreshbackRecoveryItems(
    reportForm.freshback_recovery_items
  );
  const expenseTotal = expenseItems.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const handleAddAdditionalWork = () => {
    if (reportForm.is_day_off) {
      return;
    }

    setReportForm((prev) => ({
      ...prev,
      additional_works: [...(prev.additional_works ?? []), createAdditionalWorkItem()],
    }));
  };

  const handleAdditionalWorkChange = (
    key: string,
    field: Exclude<keyof AdditionalWorkItemForm, "key">,
    value: string
  ) => {
    setReportForm((prev) => ({
      ...prev,
      additional_works: (prev.additional_works ?? []).map((item) =>
        item.key === key ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleRemoveAdditionalWork = (key: string) => {
    setReportForm((prev) => ({
      ...prev,
      additional_works: (prev.additional_works ?? []).filter(
        (item) => item.key !== key
      ),
    }));
  };

  const handleInsertExpenseRow = (key: string) => {
    if (reportForm.is_day_off) {
      return;
    }

    setReportForm((prev) => {
      const currentItems = getNormalizedExpenseItems(prev.expense_items);
      const sourceIndex = currentItems.findIndex((item) => item.key === key);
      const insertIndex = sourceIndex >= 0 ? sourceIndex + 1 : currentItems.length;

      return {
        ...prev,
        expense_items: [
          ...currentItems.slice(0, insertIndex),
          createExpenseItem(),
          ...currentItems.slice(insertIndex),
        ],
      };
    });
  };

  const handleExpenseChange = (
    key: string,
    field: Exclude<keyof ExpenseItemForm, "key">,
    value: string
  ) => {
    setReportForm((prev) => ({
      ...prev,
      expense_items: getNormalizedExpenseItems(prev.expense_items).map((item) =>
        item.key === key ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleRemoveExpense = (key: string) => {
    setReportForm((prev) => {
      const remainingItems = getNormalizedExpenseItems(prev.expense_items).filter(
        (item) => item.key !== key
      );

      return {
        ...prev,
        expense_items:
          remainingItems.length > 0 ? remainingItems : createDefaultExpenseItems(),
      };
    });
  };

  const handleFreshbackRecoveryChange = (
    key: string,
    field: Exclude<keyof FreshbackRecoveryItemForm, "key">,
    value: string
  ) => {
    setReportForm((prev) => ({
      ...prev,
      freshback_recovery_items: getNormalizedFreshbackRecoveryItems(
        prev.freshback_recovery_items
      ).map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    }));
  };

  const handleCloneFreshbackRecovery = (key: string) => {
    if (reportForm.is_day_off) {
      return;
    }

    setReportForm((prev) => {
      const currentItems = getNormalizedFreshbackRecoveryItems(
        prev.freshback_recovery_items
      );
      const sourceIndex = currentItems.findIndex((item) => item.key === key);
      const safeSourceIndex = sourceIndex >= 0 ? sourceIndex : currentItems.length - 1;
      const sourceItem = currentItems[safeSourceIndex] ?? createFreshbackRecoveryItem();

      return {
        ...prev,
        freshback_recovery_items: [
          ...currentItems.slice(0, safeSourceIndex + 1),
          createFreshbackRecoveryItem({
            unit_price: sourceItem.unit_price,
            quantity: sourceItem.quantity,
          }),
          ...currentItems.slice(safeSourceIndex + 1),
        ],
      };
    });
  };

  const handleRemoveFreshbackRecovery = (key: string) => {
    setReportForm((prev) => ({
      ...prev,
      freshback_recovery_items: getNormalizedFreshbackRecoveryItems(
        prev.freshback_recovery_items
      ).filter((item) => item.key !== key),
    }));
  };

  return (
    <div className="retro-panel rounded-[24px] p-4 sm:rounded-[28px] sm:p-5">
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="theme-label block text-left text-sm font-semibold">
            {/* 입력 날짜 */}
          </label>
          <div
            className="theme-label mx-auto flex w-full max-w-[20rem] items-center justify-center gap-5 text-[16px] font-semibold"
            style={{ marginTop: "12px", marginBottom: "12px" }}
          >
            <label className="flex items-center gap-2">
              <input
                id="today-dayoff"
                type="checkbox"
                checked={reportForm.is_day_off}
                onChange={(e) => {
                  setReportForm((prev) => ({
                    ...prev,
                    is_day_off: e.target.checked,
                    delivered_count: e.target.checked ? "" : prev.delivered_count,
                    returned_count: e.target.checked ? "" : prev.returned_count,
                    canceled_count: e.target.checked ? "" : prev.canceled_count,
                    freshback_recovery_items: e.target.checked
                      ? [createFreshbackRecoveryItem()]
                      : prev.freshback_recovery_items,
                    additional_works: e.target.checked ? [] : prev.additional_works ?? [],
                    expense_items: createDefaultExpenseItems(),
                  }));
                }}
              />
              추가 휴무
            </label>
          </div>
          <div className="mx-auto flex w-full max-w-[24rem] flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center justify-between gap-2 rounded-[18px] border border-[var(--border)] bg-[var(--field-bg)] px-2 py-2.5">
              <button
                type="button"
                onClick={() => onDateChange(previousDate)}
                disabled={!canMoveToPreviousDate}
                className="retro-button min-h-[32px] min-w-[32px] px-2 py-1.5 text-xs font-semibold disabled:cursor-default disabled:opacity-40"
                aria-label="이전 날짜"
              >
                ←
              </button>

              <p className="theme-heading text-xs font-semibold tracking-tight sm:text-sm">
                {selectedDate}
              </p>

              <button
                type="button"
                onClick={() => onDateChange(nextDate)}
                disabled={!canMoveToNextDate}
                className="retro-button min-h-[32px] min-w-[32px] px-2 py-1.5 text-xs font-semibold disabled:cursor-default disabled:opacity-40"
                aria-label="다음 날짜"
              >
                →
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddAdditionalWork}
              disabled={reportForm.is_day_off}
              className="retro-button min-h-[42px] w-full shrink-0 whitespace-nowrap px-3 py-2 text-xs font-semibold disabled:cursor-default disabled:opacity-40 sm:w-auto sm:text-sm"
            >
              추가 업무
            </button>
          </div>
          <p className="theme-copy text-xs">
            {/* 좌우 화살표를 눌러 하루씩 이동할 수 있습니다. */}
          </p>
        </div>

        <div className="mx-auto grid w-full max-w-[20rem] grid-cols-1 justify-items-center gap-x-3 gap-y-4 min-[360px]:grid-cols-2 sm:gap-x-4">
          <div className="flex w-full max-w-[8rem] flex-col items-center space-y-2">
            <label className="theme-label block text-center text-sm font-semibold">
              단가
            </label>
            <input
              type="number"
              name="unit_price_override"
              value={reportForm.unit_price_override}
              onChange={handleReportChange}
              disabled={reportForm.is_day_off}
              placeholder={
                defaultUnitPrice
                  ? `${defaultUnitPrice}원 / 직접입력`
                  : "직접입력"
              }
              className="no-spinner px-4 py-3 text-center disabled:opacity-60"
              style={{ ...compactInputStyle, marginBottom: "12px" }}
            />
          </div>

          <div className="flex w-full max-w-[8rem] flex-col items-center space-y-2">
            <label className="theme-label block text-center text-sm font-semibold">
              배송
            </label>
            <input
              type="number"
              name="delivered_count"
              value={reportForm.delivered_count}
              onChange={handleReportChange}
              disabled={reportForm.is_day_off}
              placeholder="배송"
              className="no-spinner px-4 py-3 text-center disabled:opacity-60"
              style={{ ...compactInputStyle, marginBottom: "12px" }}
            />
          </div>
        </div>

        <div
          aria-hidden="true"
          className="mx-auto h-px w-full max-w-[20rem]"
          style={{ backgroundColor: "var(--border-strong)" }}
        />

        <div className="mx-auto grid w-full max-w-[20rem] grid-cols-[minmax(0,6.8rem)_minmax(0,1fr)] items-start gap-3">
          <div className="flex w-full min-w-0 flex-col items-center space-y-2">
            <label className="theme-label block text-center text-sm font-semibold">
              반품
            </label>
            <input
              type="number"
              name="returned_count"
              value={reportForm.returned_count}
              onChange={handleReportChange}
              disabled={reportForm.is_day_off}
              placeholder="반품"
              className="no-spinner px-4 py-3 text-center disabled:opacity-60"
              style={{ ...compactInputStyle, marginBottom: "12px" }}
            />
          </div>

          <div className="flex w-full min-w-0 flex-col items-center space-y-2">
            <label className="theme-label block w-full text-center text-sm font-semibold">
              취소
            </label>
            <div className="flex w-full min-w-0 items-start gap-2">
              <input
                type="number"
                name="canceled_count"
                value={reportForm.canceled_count}
                onChange={handleReportChange}
                disabled={reportForm.is_day_off}
                placeholder="취소"
                className="no-spinner w-full min-w-0 max-w-[6.5rem] px-4 py-3 text-center disabled:opacity-60"
              />
              <div className="flex min-w-0 flex-col items-start gap-1 pt-1 text-[11px]">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={reportForm.include_canceled_in_sales}
                    disabled={reportForm.is_day_off}
                    onChange={(event) => {
                      if (!event.target.checked) {
                        return;
                      }

                      setReportForm((prev) => ({
                        ...prev,
                        include_canceled_in_sales: true,
                      }));
                    }}
                  />
                  취소건 포함
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={!reportForm.include_canceled_in_sales}
                    disabled={reportForm.is_day_off}
                    onChange={(event) => {
                      if (!event.target.checked) {
                        return;
                      }

                      setReportForm((prev) => ({
                        ...prev,
                        include_canceled_in_sales: false,
                      }));
                    }}
                  />
                  취소건 미포함
                </label>
              </div>
            </div>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="mx-auto h-px w-full max-w-[20rem]"
          style={{ backgroundColor: "var(--border-strong)" }}
        />

        <div className="mx-auto w-full max-w-[20rem] space-y-2">
          <label className="theme-label block text-center text-sm font-semibold">
            프레쉬백 회수
          </label>
          <div className="space-y-2.5">
            {freshbackRecoveryItems.map((item, index) => (
              <div
                key={item.key}
                className="grid grid-cols-2 items-end gap-2 min-[360px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5rem]"
              >
                  <div className="space-y-1">
                    <label className="theme-label block text-center text-[11px] font-semibold">
                      가격
                    </label>
                    <select
                      value={item.unit_price}
                      onChange={(e) =>
                        handleFreshbackRecoveryChange(item.key, "unit_price", e.target.value)
                      }
                      disabled={reportForm.is_day_off}
                      className="px-3 py-2 text-center disabled:opacity-60"
                      style={inlineInputStyle}
                    >
                      <option value="">가격 선택</option>
                      {freshbackRecoveryPriceOptions.map((price) => (
                        <option key={price} value={price}>
                          {price}원
                        </option>
                      ))}
                      {item.unit_price &&
                      !freshbackRecoveryPriceOptions.includes(
                        item.unit_price as (typeof freshbackRecoveryPriceOptions)[number]
                      ) ? (
                        <option value={item.unit_price}>{item.unit_price}원</option>
                      ) : null}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="theme-label block text-center text-[11px] font-semibold">
                      갯수
                    </label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        handleFreshbackRecoveryChange(item.key, "quantity", e.target.value)
                      }
                      disabled={reportForm.is_day_off}
                      placeholder="갯수"
                      className="no-spinner px-3 py-2 text-center disabled:opacity-60"
                      style={inlineInputStyle}
                    />
                  </div>

                  <div className="col-span-2 flex justify-end gap-1.5 pt-0 min-[360px]:col-span-1 min-[360px]:grid min-[360px]:h-full min-[360px]:grid-cols-2 min-[360px]:items-center min-[360px]:justify-items-end min-[360px]:pt-5">
                    {index === 0 ? (
                      <button
                        type="button"
                        onClick={() => handleCloneFreshbackRecovery(item.key)}
                        disabled={reportForm.is_day_off}
                        className="retro-button min-h-[36px] min-w-[36px] px-2 py-1.5 text-xs font-semibold disabled:cursor-default disabled:opacity-40"
                        aria-label={`프레쉬백 회수 ${index + 1} 복사`}
                      >
                        +
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRemoveFreshbackRecovery(item.key)}
                        disabled={reportForm.is_day_off}
                        className="retro-button min-h-[36px] min-w-[36px] px-2 py-1.5 text-xs font-semibold disabled:cursor-default disabled:opacity-40"
                        aria-label={`프레쉬백 회수 ${index + 1} 삭제`}
                      >
                        x
                      </button>
                    )}
                    {index > 0 ? (
                      <span aria-hidden="true" className="block h-[36px] w-[36px]" />
                    ) : (
                      <span aria-hidden="true" className="block h-[36px] w-[36px]" />
                    )}
                  </div>
              </div>
            ))}
          </div>
        </div>

        <div
          aria-hidden="true"
          className="mx-auto h-px w-full max-w-[20rem]"
          style={{ backgroundColor: "var(--border-strong)" }}
        />

        <div className="mx-auto w-full max-w-[16rem] space-y-3 sm:max-w-[17rem]">
            <div className="flex flex-wrap items-center gap-2">
              <p className="theme-copy text-xs font-semibold">
                총 지출 {formatMoney(expenseTotal)}
              </p>
            </div>

            {expenseItems.map((item, index) => (
              <div
                key={item.key}
                className="grid grid-cols-[minmax(0,1fr)_4.75rem_2.25rem] items-center gap-2 min-[380px]:grid-cols-[minmax(0,1fr)_5.5rem_2.25rem] min-[380px]:gap-2.5"
              >
                  <input
                    type="text"
                    aria-label={`지출 ${index + 1} 내용`}
                    value={item.description}
                    onChange={(e) =>
                      handleExpenseChange(item.key, "description", e.target.value)
                    }
                    disabled={reportForm.is_day_off}
                    placeholder="지출내용"
                    className="px-3 py-2 text-left disabled:opacity-60"
                    style={inlineInputStyle}
                  />

                  <input
                    type="number"
                    aria-label={`지출 ${index + 1} 비용`}
                    value={item.amount}
                    onChange={(e) =>
                      handleExpenseChange(item.key, "amount", e.target.value)
                    }
                    disabled={reportForm.is_day_off}
                    placeholder="지출비용"
                    className="no-spinner px-2.5 py-2 text-center disabled:opacity-60"
                    style={inlineInputStyle}
                  />

                  {index === 0 ? (
                    <button
                      type="button"
                      onClick={() => handleInsertExpenseRow(item.key)}
                      disabled={reportForm.is_day_off}
                      className="retro-button flex min-h-[36px] min-w-[36px] items-center justify-center px-2 py-1.5 text-xs font-semibold disabled:cursor-default disabled:opacity-40"
                      aria-label="지출 행 추가"
                    >
                      +
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRemoveExpense(item.key)}
                      disabled={reportForm.is_day_off}
                      className="retro-button flex min-h-[36px] min-w-[36px] items-center justify-center px-2 py-1.5 text-xs font-semibold disabled:cursor-default disabled:opacity-40"
                      aria-label={`지출 ${index + 1} 삭제`}
                    >
                      X
                    </button>
                  )}
              </div>
            ))}
          </div>

        <div
          aria-hidden="true"
          className="mx-auto h-px w-full max-w-[17rem]"
          style={{ backgroundColor: "var(--border-strong)" }}
        />

        {additionalWorks.length > 0 ? (
          <div className="space-y-3">
            {additionalWorks.map((item, index) => (
              <div
                key={item.key}
                className="retro-card rounded-[20px] px-3 py-3 sm:rounded-[24px] sm:px-4 sm:py-4"
              >
                <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
                  <div className="space-y-1">
                    <label className="theme-label block text-center text-[11px] font-semibold">
                      단가
                    </label>
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) =>
                        handleAdditionalWorkChange(item.key, "unit_price", e.target.value)
                      }
                      disabled={reportForm.is_day_off}
                      placeholder="단가"
                      className="no-spinner px-2 py-2 text-center disabled:opacity-60"
                      style={inlineInputStyle}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="theme-label block text-center text-[11px] font-semibold">
                      배송
                    </label>
                    <input
                      type="number"
                      value={item.delivered_count}
                      onChange={(e) =>
                        handleAdditionalWorkChange(
                          item.key,
                          "delivered_count",
                          e.target.value
                        )
                      }
                      disabled={reportForm.is_day_off}
                      placeholder="배송"
                      className="no-spinner px-2 py-2 text-center disabled:opacity-60"
                      style={inlineInputStyle}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="theme-label block text-center text-[11px] font-semibold">
                      반품
                    </label>
                    <input
                      type="number"
                      value={item.returned_count}
                      onChange={(e) =>
                        handleAdditionalWorkChange(
                          item.key,
                          "returned_count",
                          e.target.value
                        )
                      }
                      disabled={reportForm.is_day_off}
                      placeholder="반품"
                      className="no-spinner px-2 py-2 text-center disabled:opacity-60"
                      style={inlineInputStyle}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="theme-label block text-center text-[11px] font-semibold">
                      취소
                    </label>
                    <input
                      type="number"
                      value={item.canceled_count}
                      onChange={(e) =>
                        handleAdditionalWorkChange(
                          item.key,
                          "canceled_count",
                          e.target.value
                        )
                      }
                      disabled={reportForm.is_day_off}
                      placeholder="취소"
                      className="no-spinner px-2 py-2 text-center disabled:opacity-60"
                      style={inlineInputStyle}
                    />
                  </div>

                  <div className="col-span-2 flex h-full items-center justify-end pt-1 sm:col-span-1 sm:justify-center sm:pb-0.5 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => handleRemoveAdditionalWork(item.key)}
                      className="retro-button min-h-[36px] min-w-[36px] px-2 py-1.5 text-xs font-semibold"
                      aria-label={`추가 업무 ${index + 1} 삭제`}
                    >
                      x
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="space-y-2 text-center">
          <label
            className="theme-label block text-center text-sm font-semibold"
            style={{ marginBottom: "12px" }}
          >
            특이사항
          </label>
          <textarea
            name="memo"
            value={reportForm.memo}
            onChange={handleReportChange}
            className="min-h-[112px] px-4 py-3 text-left"
            style={{ marginBottom: "12px" }}
          />
        </div>

        <button
          onClick={onSave}
          disabled={saving}
          className="retro-button-solid ui-action-fit min-h-[48px] px-5 py-3.5 text-base font-semibold disabled:opacity-60"
          style={{ marginBottom: "12px" }}
        >
          {saving ? "저장 중..." : "저 장"}
        </button>
      </div>
    </div>
  );
}