"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export async function placeOrder(
  batchId: string,
  quantity: number,
  note: string,
): Promise<{ ok: boolean; message: string; orderId?: string }> {
  const profile = await requireProfile();
  if (profile.role !== "buyer") {
    return { ok: false, message: "Chỉ tài khoản doanh nghiệp mới đặt mua được." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_batch_id: batchId,
    p_quantity: quantity,
    p_note: note || undefined,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/don-hang");
  revalidatePath(`/cho/${batchId}`);
  return { ok: true, message: "Đã tạo đơn hàng, chuyển sang bước thanh toán.", orderId: data as string };
}

/**
 * Thanh toán thử. Khi cắm cổng thanh toán thật, chỗ này được thay bằng webhook của
 * nhà cung cấp gọi vào cùng hàm settle phía cơ sở dữ liệu.
 */
export async function settlePayment(
  orderId: string,
  succeed: boolean,
): Promise<{ ok: boolean; message: string }> {
  await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("settle_sandbox_payment", {
    p_order_id: orderId,
    p_succeed: succeed,
  });

  if (error) return { ok: false, message: error.message };

  const result = data as unknown as { status: string };
  revalidatePath("/don-hang");
  return {
    ok: result.status === "succeeded",
    message:
      result.status === "succeeded"
        ? "Thanh toán thành công. Doanh thu đã được chia theo tỷ lệ đóng góp của từng hộ."
        : "Giao dịch thử bị từ chối — đơn hàng vẫn ở trạng thái chờ thanh toán.",
  };
}
