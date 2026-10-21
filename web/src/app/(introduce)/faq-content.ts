// Shared by the FAQ section and the FAQPage structured data, so the markup always matches what visitors read.

export const INTRODUCE_FAQ = {
  "zh-CN": [
    {
      id: "unique",
      question: "Oyscat 的独特之处？",
      answer: [
        "两种造物方式随意切换：支持生成式 AI 自动建模，一句话生成你想要的模型；也可以手动拼搭、自由组合模块。",
        "从创意构思到实物产出全程打通，设计、验证、制作均在一个系统内无缝衔接，实现「想法即实物」的一体化造物流程。",
      ],
    },
    {
      id: "modules",
      question: "Oyscat 电子模块如何连接虚拟与现实？",
      answer: [
        "Oyscat 工作台中的每一个虚拟电子模块，都拥有外观与功能完全一致的实体模块与之对应；用户为模块编写的控制程序可直接下载到实体模块中运行，虚拟仿真与现实运行保持完全同步，让创意在虚拟世界中验证、在现实世界中落地。",
      ],
    },
    {
      id: "making",
      question: "用 Oyscat 工作台完成的造物，如何落地实体制作？",
      answer: [
        "Oyscat 支持结合 3D 打印完成实体化，用户作品的静态结构可一键导出为 3D 模型，打印出的外壳能与电子模块直接拼装；同时也支持瓦楞纸、木板、亚克力等多种材料的手工造壳方式，灵活适配不同的创作条件与场景需求",
      ],
    },
    {
      id: "barriers",
      question: "Oyscat 解决了哪些痛点？",
      answer: [
        "传统电子创作中，硬件选型、电路设计与程序编写是用户必须面对的三道门槛，Oyscat 将这些门槛彻底消除，用户只需描述创意，从硬件配置到程序编写，皆由 AI 与系统协同完成，让创作回归创意本身。",
        "同时，针对复杂电子项目开发周期长、试错成本高的问题，Oyscat 支持在虚拟环境中前置验证方案，仿真通过后即可直接实物落地，真正实现「想造就造」。",
      ],
    },
  ],
  en: [
    {
      id: "unique",
      question: "What makes Oyscat different?",
      answer: [
        "Switch between two ways of creating at will: generative AI modeling turns a single sentence into the model you want, or you can build by hand and combine modules freely.",
        "From initial idea to physical creation, the whole journey is connected: design, validation and making flow seamlessly within one system, an all-in-one workflow where an idea becomes a real object.",
      ],
    },
    {
      id: "modules",
      question: "How do Oyscat modules connect the virtual and physical worlds?",
      answer: [
        "Every virtual electronic module in Oyscat Workspace has a physical counterpart with matching appearance and functionality. Control programs can be downloaded directly to the physical modules, connecting virtual simulation with real-world operation so ideas can be validated on screen and brought to life in your hands.",
      ],
    },
    {
      id: "making",
      question: "How do I turn a workspace design into a physical creation?",
      answer: [
        "Oyscat supports 3D printing: export your creation's static structure as a 3D model and assemble the printed enclosure with its electronic modules. You can also build enclosures by hand using corrugated cardboard, wood or acrylic, adapting the process to your materials and creative setting.",
      ],
    },
    {
      id: "barriers",
      question: "What challenges does Oyscat address?",
      answer: [
        "Traditional electronic projects require choosing hardware, designing circuits and writing programs. Oyscat brings AI and the system together to handle hardware configuration and programming from your description, putting the focus back on the idea itself.",
        "Complex projects can also take a long time and involve costly trial and error. Oyscat lets you validate a design in a virtual environment before moving to physical assembly, making it easier to turn an idea into a creation.",
      ],
    },
  ],
} satisfies Record<"zh-CN" | "en", { id: string; question: string; answer: string[] }[]>
