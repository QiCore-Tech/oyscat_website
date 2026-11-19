// Shared by the FAQ section and the FAQPage structured data, so the markup always matches what visitors read.

export const INTRODUCE_FAQ = {
  "zh-CN": [
    {
      id: "unique",
      question: "Oyscat 的独特之处？",
      answer: [
        "Oyscat 是打通想法与实体的端到端造物系统。设计、验证、制作在同一系统内无缝衔接。不同于只能生成静态外壳的 AI 工具，Oyscat 的造物电气化、可交互、能自主运行，真正实现「想法即实物」。",
      ],
    },
    {
      id: "modules",
      question: "Oyscat 电子模块如何连接虚拟与现实？",
      answer: [
        "Oyscat 的每个电子模块，在软件中都有对应的虚拟映射。仿真验证通过后，控制程序可一键下载到实体电子模块中运行，表现与仿真一致。创意在虚拟中验证，在现实中落地。",
      ],
    },
    {
      id: "making",
      question: "用 Oyscat 工作台完成的造物，如何落地实体制作？",
      answer: [
        "作品中的静态结构可一键导出为 3D 模型进行打印，外壳与电子模块直接拼装。也支持用瓦楞纸、木板、亚克力手工制作外壳，再装入电子模块。无论哪种方式，终点都不是一个空壳，而是一件能动能亮、真正运行的造物。",
      ],
    },
    {
      id: "barriers",
      question: "Oyscat 解决了哪些痛点？",
      answer: [
        "传统电子创作中，硬件选型、电路设计、程序编写是三道门槛，Oyscat 将其彻底消除：你只需描述创意，从硬件配置到程序编写皆由 AI 完成，让创作回归创意本身。",
        "针对复杂项目开发周期长、试错成本高的问题，Oyscat 支持在虚拟环境中前置验证，仿真通过即可实物落地，真正实现「想造就造」。",
      ],
    },
  ],
  en: [
    {
      id: "unique",
      question: "What makes Oyscat different?",
      answer: [
        "Oyscat takes an idea all the way from design to a working physical creation. Design, testing, and building all happen in one connected workflow.",
        "Unlike AI tools that only generate static 3D models, Oyscat helps you create electronic, interactive projects that can run on their own.",
      ],
    },
    {
      id: "modules",
      question: "How do Oyscat Electronic Blocks connect the virtual and physical worlds?",
      answer: [
        "Each Oyscat Electronic Block has a virtual counterpart in the Workspace. Once your simulation works, download the control program to the physical blocks with one click. They behave just as they did in the simulation.",
      ],
    },
    {
      id: "making",
      question: "How do I turn my digital design into a physical build?",
      answer: [
        "Export a 3D-print-ready file of your creation’s structure with one click, then print it. The printed shell is designed to fit the electronic blocks.",
        "Prefer to build by hand? Make a shell from cardboard, wood, or acrylic, then add the blocks. Either way, the result is more than an empty shell. It’s a working creation that moves and lights up.",
      ],
    },
    {
      id: "barriers",
      question: "What problems does Oyscat solve?",
      answer: [
        "Electronics projects usually involve choosing parts, designing circuits, and writing code. Oyscat removes these barriers. Just describe your idea, and AI handles everything from hardware setup to programming, so you can focus on creating.",
        "Complex projects can take a long time to develop, and every mistake can be costly. Oyscat lets you test your ideas in a virtual environment first. Once the simulation works, bring your creation to life in the real world.",
        "With Oyscat, if you can imagine it, you can build it.",
      ],
    },
  ],
} satisfies Record<"zh-CN" | "en", { id: string; question: string; answer: string[] }[]>
