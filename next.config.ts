import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {
    typedRoutes: false,
    serverActions: {
      /**
       * Mặc định của Next là 1 MB. Giao diện lại hứa 50 MB và server action tự kiểm
       * `file.size > 52_428_800`, nên mọi tệp trên 1 MB chết ở tầng framework TRƯỚC khi
       * action chạy: không có Result nào trả về, `useActionState` không nhận gì, người
       * dùng bấm "Tải lên" rồi không thấy gì xảy ra. Đó là lý do bucket không có một
       * object nào từ lượt tải thật.
       *
       * Đặt 4 MB chứ không phải 50 MB vì Vercel giới hạn CỨNG thân request của serverless
       * function ở 4,5 MB và không nâng được bằng cấu hình. Khai 50 MB ở đây chỉ dời chỗ
       * thất bại từ Next sang Vercel, vẫn im lặng như cũ.
       *
       * Tệp lớn hơn phải đi đường tải thẳng lên Storage bằng signed URL, không qua server
       * action. Cho tới khi có đường đó, giao diện phải nói đúng 4 MB thay vì 50 MB.
       */
      bodySizeLimit: "4mb",
    },
  },
};

export default config;
