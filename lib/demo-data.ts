import type { DiarySummary } from "@/lib/types";

export const demoDate = "2026-05-07";
export const demoCreatedAt = "2026-05-07T08:00:00.000Z";

export const demoImageUrl =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDX0t1kmtSw6WBdEBYEwBs8_ZvRvmbzRlQxtQW-GXeLcFDmIVOtm5Vx4H0Dr-8uGk7Ku_y_yhxcDP3RctV1jHfB8EyYLeHv1OYKFkkJyXFO_MuUzkLd425_QPpafwqfhEKvaR7W1PU10eLzkdAQ3CoNRY5RHc6LM2kK8dPjeBTAuYbSlY9Q6t2GwEdq6Y8qMfqKaDC_EQ6fSfQTHLWIlAD3QiMWJXhhAplhG-ZuxmTF7vlmFA53oXFsS7DDIz90uXGb2C9_Qrd5aAfY";

export const demoDiary: DiarySummary = {
  id: "demo-diary",
  title: "深夜里的一束光",
  summary: "一次围绕照片、压力和自我安顿的语音日记。",
  content:
    "今天我把这张照片放进了日记里。它让我想起最近那些没有说出口的疲惫，也提醒我，很多珍贵的时刻并不一定轰轰烈烈。也许只是安静下来，承认自己已经走了很远，就已经是一种温柔的整理。",
  date: demoDate,
  createdAt: demoCreatedAt,
  imageUrl: demoImageUrl,
  status: "generated",
  messages: [
    {
      id: "m1",
      role: "assistant",
      inputType: "ai_voice",
      transcript: "我注意到这张照片里有一些很安静的细节。你想从哪里开始讲起？",
      audioUrl: "",
      createdAt: demoCreatedAt
    },
    {
      id: "m2",
      role: "user",
      inputType: "text",
      text: "这是我今天下班后拍的，那一刻突然觉得可以慢下来。",
      createdAt: demoCreatedAt
    },
    {
      id: "m3",
      role: "assistant",
      inputType: "ai_voice",
      transcript: "听起来那个瞬间像是给你留了一点喘息的空间。那时你心里最明显的感受是什么？",
      audioUrl: "",
      createdAt: demoCreatedAt
    }
  ]
};
