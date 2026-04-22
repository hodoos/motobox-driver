import { createPortal } from "react-dom";
import { formatMoney } from "../../lib/format";
import { ExpenseItemForm, FreshbackRecoveryItemForm, ReportForm } from "../../types";

const freshbackRecoveryPriceOptions = ["100", "150", "200"] as const;

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

type Props = {
  open: boolean;
  selectedDate: string;
  reportForm: ReportForm;
  setReportForm: React.Dispatch<React.SetStateAction<ReportForm>>;
  defaultUnitPrice: number;
  handleReportChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
};

export default function ReportModal({
  open,
  selectedDate,
  reportForm,
  setReportForm,
  defaultUnitPrice,
  handleReportChange,
  onClose,
  onSave,
  saving,
}: Props) {
  if (!open || typeof document === "undefined") return null;

  const freshbackRecoveryItems = getNormalizedFreshbackRecoveryItems(
    reportForm.freshback_recovery_items
  );
  const expenseItems = getNormalizedExpenseItems(reportForm.expense_items);
  const expenseTotal = expenseItems.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

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

  return createPortal(
    <div
      className="z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100dvh",
      }}
    >
      <div
        className="retro-panel overflow-y-auto rounded-[24px] px-3 py-3 sm:px-4 sm:py-4"
        style={{
          width: "min(26rem, calc(100vw - 1rem))",
          maxHeight: "76dvh",
        }}
      >
        <div className="mb-2.5 flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <h3 className="retro-title theme-heading text-sm leading-none sm:text-base">
              일일 업무 상세
            </h3>
            <p className="theme-copy text-xs sm:text-sm">{selectedDate}</p>
          </div>
          <button
            onClick={onClose}
            className="retro-button min-h-[32px] shrink-0 px-2.5 py-1 text-xs font-semibold"
          >
            닫기
          </button>
        </div>

        <div className="space-y-2.5">
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <div className="space-y-1">
              <label className="theme-label block text-xs font-semibold">단가</label>
              <input
                type="number"
                name="unit_price_override"
                value={reportForm.unit_price_override}
                onChange={handleReportChange}
                disabled={reportForm.is_day_off}
                placeholder={defaultUnitPrice ? `${defaultUnitPrice}원` : "단가"}
                className="no-spinner h-10 px-3 py-2 text-left text-sm disabled:opacity-60"
              />
            </div>
            <label className="theme-note-box theme-label flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold">
              <input
                id="dayoff"
                type="checkbox"
                checked={reportForm.is_day_off}
                onChange={(e) =>
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
                  }))
                }
              />
              휴무
            </label>
          </div>

          <div className="grid grid-cols-[minmax(0,5.25rem)_minmax(0,5.25rem)_minmax(0,1fr)] items-start gap-2">
            <div className="space-y-1">
              <label className="theme-label block text-[11px] font-semibold">배송</label>
              <input
                type="number"
                name="delivered_count"
                value={reportForm.delivered_count}
                onChange={handleReportChange}
                disabled={reportForm.is_day_off}
                placeholder="배송"
                className="no-spinner h-10 px-2 py-2 text-center text-sm disabled:opacity-60"
              />
            </div>

            <div className="space-y-1">
              <label className="theme-label block text-[11px] font-semibold">반품</label>
              <input
                type="number"
                name="returned_count"
                value={reportForm.returned_count}
                onChange={handleReportChange}
                disabled={reportForm.is_day_off}
                placeholder="반품"
                className="no-spinner h-10 px-2 py-2 text-center text-sm disabled:opacity-60"
              />
            </div>

            <div className="space-y-1">
              <label className="theme-label block text-[11px] font-semibold">취소</label>
              <div className="flex items-start gap-2">
                <input
                  type="number"
                  name="canceled_count"
                  value={reportForm.canceled_count}
                  onChange={handleReportChange}
                  disabled={reportForm.is_day_off}
                  placeholder="취소"
                  className="no-spinner h-10 w-full max-w-[4.75rem] px-2 py-2 text-center text-sm disabled:opacity-60"
                />
                <div className="flex min-w-0 flex-col gap-1 pt-1 text-[10px]">
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

          <div className="space-y-1.5">
            <label className="theme-label block text-xs font-semibold">
              프레쉬백 회수
            </label>
            <div className="space-y-2">
              {freshbackRecoveryItems.map((item, index) => (
                <div
                  key={item.key}
                  className="grid grid-cols-2 items-end gap-2 min-[360px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5rem]"
                >
                    <div className="space-y-1">
                      <label className="theme-label block text-[11px] font-semibold">
                        가격
                      </label>
                      <select
                        value={item.unit_price}
                        onChange={(e) =>
                          handleFreshbackRecoveryChange(
                            item.key,
                            "unit_price",
                            e.target.value
                          )
                        }
                        disabled={reportForm.is_day_off}
                        className="h-10 px-2 py-2 text-center text-sm disabled:opacity-60"
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
                      <label className="theme-label block text-[11px] font-semibold">
                        갯수
                      </label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          handleFreshbackRecoveryChange(
                            item.key,
                            "quantity",
                            e.target.value
                          )
                        }
                        disabled={reportForm.is_day_off}
                        placeholder="갯수"
                        className="no-spinner h-10 px-2 py-2 text-center text-sm disabled:opacity-60"
                      />
                    </div>

                    <div className="col-span-2 flex justify-end gap-1.5 pt-0 min-[360px]:col-span-1 min-[360px]:grid min-[360px]:h-full min-[360px]:grid-cols-2 min-[360px]:items-center min-[360px]:justify-items-end min-[360px]:pt-5">
                      {index === 0 ? (
                        <button
                          type="button"
                          onClick={() => handleCloneFreshbackRecovery(item.key)}
                          disabled={reportForm.is_day_off}
                          className="retro-button min-h-[34px] min-w-[34px] px-2 py-1 text-xs font-semibold disabled:opacity-40"
                          aria-label={`프레쉬백 회수 ${index + 1} 복사`}
                        >
                          +
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRemoveFreshbackRecovery(item.key)}
                          disabled={reportForm.is_day_off}
                          className="retro-button min-h-[34px] min-w-[34px] px-2 py-1 text-xs font-semibold disabled:opacity-40"
                          aria-label={`프레쉬백 회수 ${index + 1} 삭제`}
                        >
                          x
                        </button>
                      )}
                      {index > 0 ? (
                        <span aria-hidden="true" className="block h-[34px] w-[34px]" />
                      ) : (
                        <span aria-hidden="true" className="block h-[34px] w-[34px]" />
                      )}
                    </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="theme-copy text-[11px] font-semibold">
                총 지출 {formatMoney(expenseTotal)}
              </p>
            </div>

            <div className="mx-auto w-full max-w-[16rem] space-y-2">
                {expenseItems.map((item, index) => (
                  <div
                    key={item.key}
                    className="grid grid-cols-[minmax(0,1fr)_5.5rem_2.25rem] items-center gap-2.5"
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
                      className="h-10 px-3 py-2 text-left text-sm disabled:opacity-60"
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
                      className="no-spinner h-10 px-2.5 py-2 text-center text-sm disabled:opacity-60"
                    />

                    {index === 0 ? (
                      <button
                        type="button"
                        onClick={() => handleInsertExpenseRow(item.key)}
                        disabled={reportForm.is_day_off}
                        className="retro-button flex min-h-[34px] min-w-[34px] items-center justify-center px-2 py-1 text-xs font-semibold disabled:opacity-40"
                        aria-label="지출 행 추가"
                      >
                        +
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRemoveExpense(item.key)}
                        disabled={reportForm.is_day_off}
                        className="retro-button flex min-h-[34px] min-w-[34px] items-center justify-center px-2 py-1 text-xs font-semibold disabled:opacity-40"
                        aria-label={`지출 ${index + 1} 삭제`}
                      >
                        X
                      </button>
                    )}
                  </div>
                ))}
              </div>
          </div>

          <div className="space-y-1">
            <label className="theme-label block text-xs font-semibold">메모</label>
            <textarea
              name="memo"
              value={reportForm.memo}
              onChange={handleReportChange}
              className="min-h-[72px] px-3 py-2 text-sm"
              style={{ height: "72px" }}
            />
          </div>

          <button
            onClick={onSave}
            disabled={saving}
            className="retro-button-solid min-h-[38px] w-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}