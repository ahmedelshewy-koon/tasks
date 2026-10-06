// Translations for V1 advanced core features: roles, archive, health,
// recurrence, mentions, tags, custom fields, saved views, templates,
// project overview/activity and workload.
export const advancedAr: Record<string, string> = {
  // Navigation and pages
  Workload: "عبء العمل",
  Templates: "القوالب",
  Archive: "الأرشيف",
  "Team workload": "عبء عمل الفريق",
  "Open, in-progress, overdue and upcoming work for each person, by task count.":
    "المهام المفتوحة وقيد التنفيذ والمتأخرة والقريبة لكل شخص، حسب عدد المهام.",
  "Project templates": "قوالب المشاريع",
  "Reusable project structures with sections, tasks, milestones and checklists.":
    "هياكل مشاريع قابلة لإعادة الاستخدام تضم الأقسام والمهام والمعالم وقوائم التحقق.",
  "Restore archived work, or delete it permanently.":
    "استعد العناصر المؤرشفة أو احذفها نهائيًا.",
  "Restore archived projects and tasks you manage.":
    "استعد المشاريع والمهام المؤرشفة التي تديرها.",
  Overview: "نظرة عامة",
  "Project Map": "خريطة المشروع",
  Activity: "النشاط",

  // Roles
  Owner: "المالك",
  Admin: "مدير النظام",
  "Project manager": "مدير المشروع",
  Member: "عضو",
  Viewer: "مشاهد",
  Role: "الدور",
  "Members and roles": "الأعضاء والأدوار",
  "No employees available to add.": "لا يوجد موظفون متاحون للإضافة.",
  "Admins can add any employee.": "يمكن لمدير النظام إضافة أي موظف.",
  "You can add employees from the owner’s team or your own reports.":
    "يمكنك إضافة موظفين من فريق المالك أو من التابعين لك.",
  "You can add employees below you in the organization.":
    "يمكنك إضافة الموظفين التابعين لك في الهيكل التنظيمي.",
  "Project managers manage tasks, sections, milestones and members. Members work on their tasks and comment. Viewers can only read.":
    "يدير مدير المشروع المهام والأقسام والمعالم والأعضاء. يعمل العضو على مهامه ويعلّق. المشاهد للقراءة فقط.",
  "The previous owner stays on the project as a project manager.":
    "يبقى المالك السابق في المشروع بدور مدير المشروع.",
  "Project managers can assign any project member except viewers.":
    "يمكن لمديري المشروع إسناد المهام لأي عضو في المشروع عدا المشاهدين.",
  "More project actions": "إجراءات أخرى للمشروع",

  // Project creation and templates
  "Start from": "البدء من",
  "Blank project": "مشروع فارغ",
  "Add sections and tasks yourself.": "أضف الأقسام والمهام بنفسك.",
  "From template": "من قالب",
  "Reuse sections, tasks, milestones and checklists.":
    "أعد استخدام الأقسام والمهام والمعالم وقوائم التحقق.",
  "No templates yet. Managers can save a project as a template.":
    "لا توجد قوالب بعد. يمكن للمديرين حفظ مشروع كقالب.",
  Template: "القالب",
  "Choose a template": "اختر قالبًا",
  "Due dates are placed relative to the project start date (today if empty).":
    "تُحدد مواعيد التسليم نسبةً إلى تاريخ بدء المشروع (أو اليوم إن لم يُحدد).",
  "Template assignees who are not project members are replaced by the owner.":
    "يُستبدل المسؤولون في القالب غير الأعضاء في المشروع بمالك المشروع.",
  sections: "أقسام",
  subtasks: "مهام فرعية",
  milestones: "معالم",
  dependencies: "اعتماديات",
  "checklist items": "عناصر تحقق",
  "Start day": "يوم البدء",
  Day: "اليوم",
  "No templates yet": "لا توجد قوالب بعد",
  "Open a project you manage and choose “Save as template” to reuse its structure.":
    "افتح مشروعًا تديره واختر «حفظ كقالب» لإعادة استخدام هيكله.",
  "Templates created by managers will appear here.":
    "ستظهر هنا القوالب التي ينشئها المديرون.",
  "Use template": "استخدام القالب",
  "View contents": "عرض المحتوى",
  "Hide contents": "إخفاء المحتوى",
  Rename: "إعادة التسمية",
  "Rename template": "إعادة تسمية القالب",
  "Template name": "اسم القالب",
  "Save as template": "حفظ كقالب",
  "Save template": "حفظ القالب",
  "Saves sections, tasks, subtasks, milestones, priorities, dependencies and checklists. Due dates are kept relative to the project start. Archived tasks, comments and files are not included.":
    "يحفظ الأقسام والمهام والمهام الفرعية والمعالم والأولويات والاعتماديات وقوائم التحقق. تُحفظ المواعيد نسبةً إلى بدء المشروع. لا تُضمَّن المهام المؤرشفة والتعليقات والملفات.",
  "Include assignees": "تضمين المسؤولين",
  "Used only when those people are members of the new project.":
    "يُستخدمون فقط إذا كانوا أعضاء في المشروع الجديد.",
  "Former member": "عضو سابق",
  Save: "حفظ",
  "Saving…": "جارٍ الحفظ…",

  // Health
  "Project health": "صحة المشروع",
  "Health status": "حالة صحة المشروع",
  "On track": "على المسار",
  "At risk": "معرض للخطر",
  "Off track": "خارج المسار",
  Automatic: "تلقائي",
  "Set manually": "محددة يدويًا",
  Suggested: "المقترح",
  "Suggested by TASK from progress and due dates.":
    "يقترحها TASK بناءً على التقدم ومواعيد التسليم.",
  "The project is marked completed.": "المشروع محدد كمكتمل.",
  "Every task is done.": "اكتملت جميع المهام.",
  "The project due date has passed.": "تجاوز المشروع موعد تسليمه.",
  "Some tasks are overdue.": "بعض المهام متأخرة.",
  "A quarter or more of the tasks are overdue.": "ربع المهام أو أكثر متأخرة.",
  "Milestones are past their date.": "تجاوزت بعض المعالم موعدها.",
  "Progress is behind the time elapsed.": "التقدم أبطأ من الوقت المنقضي.",
  "Progress is far behind the time elapsed.":
    "التقدم متأخر كثيرًا عن الوقت المنقضي.",
  "Due within 7 days with less than 80% done.":
    "يحل موعد التسليم خلال 7 أيام والإنجاز أقل من 80%.",

  // Overview
  "tasks done": "مهام مكتملة",
  Due: "التسليم",
  "overdue milestones": "معالم متأخرة",
  "No overdue milestones": "لا توجد معالم متأخرة",
  "Next milestone": "المعلم التالي",
  "All milestones completed": "اكتملت جميع المعالم",
  "View all in List": "عرض الكل في القائمة",
  "Upcoming Tasks": "المهام القادمة",
  "Next 14 days": "الأيام الـ14 القادمة",
  "Nothing is overdue.": "لا توجد مهام متأخرة.",
  "No tasks due in the next 14 days.": "لا توجد مهام مستحقة خلال 14 يومًا.",
  "No assigned work yet.": "لا توجد مهام مسندة بعد.",
  Manage: "إدارة",
  "Open Project Map": "فتح خريطة المشروع",
  "Recent activity": "آخر النشاطات",
  "View all activity": "عرض كل النشاط",

  // Activity feed
  "No project activity yet.": "لا يوجد نشاط في المشروع بعد.",
  "Show older activity": "عرض النشاط الأقدم",
  "Loading…": "جارٍ التحميل…",
  "Completion requested": "طلب إكمال",
  "Next due": "الموعد التالي",
  "Next occurrence": "التكرار التالي",
  "feed:project_created": "· إنشاء المشروع",
  "feed:project_status_changed": "· تغيير حالة المشروع",
  "feed:task_created": "· إنشاء مهمة",
  "feed:task_completed": "· اكتمال مهمة",
  "feed:status_changed": "· تغيير حالة مهمة",
  "feed:comment_created": "· تعليق على",
  "feed:assignee_added": "· إسناد",
  "feed:assignee_removed": "· إلغاء إسناد",
  "feed:milestone_created": "· إنشاء معلم",
  "feed:milestone_updated": "· تحديث معلم",
  "feed:dependency_added": "· إضافة اعتمادية إلى",
  "feed:dependency_removed": "· إزالة اعتمادية من",
  "feed:member_added": "· إضافة عضو",
  "feed:member_removed": "· إزالة عضو",
  "feed:member_role_changed": "· تغيير دور عضو",
  "feed:owner_changed": "· تغيير مالك المشروع",
  "feed:health_overridden": "· تعديل صحة المشروع يدويًا",
  "feed:health_override_cleared": "· إعادة صحة المشروع إلى الوضع التلقائي",
  "feed:project_archived": "· أرشفة المشروع",
  "feed:project_restored": "· استعادة المشروع",
  "feed:project_deleted_permanently": "· حذف مشروع نهائيًا",
  "feed:task_archived": "· أرشفة مهمة",
  "feed:task_restored": "· استعادة مهمة",
  "feed:task_deleted_permanently": "· حذف مهمة نهائيًا",
  "feed:recurrence_created": "· إنشاء التكرار التالي لـ",

  // Task activity (drawer)
  project_created: "أُنشئ المشروع",
  project_status_changed: "تغيرت حالة المشروع",
  member_added: "أضيف عضو",
  member_removed: "أزيل عضو",
  member_role_changed: "تغير دور عضو",
  owner_changed: "تغير مالك المشروع",
  health_overridden: "عُدلت صحة المشروع يدويًا",
  health_override_cleared: "أعيدت صحة المشروع إلى الوضع التلقائي",
  project_archived: "أُرشف المشروع",
  project_restored: "استُعيد المشروع",
  project_deleted_permanently: "حُذف المشروع نهائيًا",
  task_archived: "أُرشفت المهمة",
  task_restored: "استُعيدت المهمة",
  task_deleted_permanently: "حُذفت المهمة نهائيًا",
  recurrence_created: "أُنشئ التكرار التالي",
  recurrence_stopped: "توقف التكرار: لا يوجد مسؤولون متاحون",
  recurrence_changed: "تغير التكرار",
  tag_added: "أضيف وسم",
  tag_removed: "أزيل وسم",
  field_created: "أضيف حقل مخصص",
  field_updated: "عُدل حقل مخصص",
  field_removed: "أزيل حقل مخصص",
  field_changed: "تغيرت قيمة حقل",
  template_created: "حُفظ المشروع كقالب",

  // Archive
  "Archive project": "أرشفة المشروع",
  "Archive task": "أرشفة المهمة",
  Restore: "استعادة",
  "Delete permanently": "حذف نهائي",
  "Archived projects": "المشاريع المؤرشفة",
  "No archived projects.": "لا توجد مشاريع مؤرشفة.",
  "Archived tasks": "المهام المؤرشفة",
  "No archived tasks.": "لا توجد مهام مؤرشفة.",
  Archived: "أُرشفت في",
  "Nothing archived": "لا يوجد شيء مؤرشف",
  "Archived projects and tasks you manage will appear here until they are restored or deleted.":
    "ستظهر هنا المشاريع والمهام المؤرشفة التي تديرها حتى تُستعاد أو تُحذف.",
  "Archive history": "سجل الأرشفة",
  "Admins only": "لمديري النظام فقط",
  "No archive activity yet.": "لا يوجد نشاط أرشفة بعد.",
  "Archived items leave lists, boards, calendars and reports. Managers can restore them from Archive.":
    "تختفي العناصر المؤرشفة من القوائم واللوحات والتقويم والتقارير، ويمكن للمديرين استعادتها من الأرشيف.",
  "This permanently deletes the item, its subtasks, comments, files and history. It cannot be undone.":
    "سيُحذف العنصر ومهامه الفرعية وتعليقاته وملفاته وسجله نهائيًا، ولا يمكن التراجع عن ذلك.",
  "This task is archived. It is hidden from lists, boards and reports.":
    "هذه المهمة مؤرشفة ومخفية من القوائم واللوحات والتقارير.",
  "This task is archived with its parent task or project.":
    "هذه المهمة مؤرشفة مع مهمتها الرئيسية أو مشروعها.",
  "Restore this task to continue the conversation.":
    "استعد المهمة لمتابعة النقاش.",

  // Recurrence
  Repeats: "التكرار",
  "Does not repeat": "لا تتكرر",
  Daily: "يوميًا",
  Weekly: "أسبوعيًا",
  Monthly: "شهريًا",
  "When this task is done, the next one is created with the same details and a new due date.":
    "عند اكتمال هذه المهمة تُنشأ المهمة التالية بالتفاصيل نفسها وموعد تسليم جديد.",

  // Mentions and comments
  "Mentioned you": "أشار إليك",
  "Write a comment… Type @ to mention a project member":
    "اكتب تعليقًا… اكتب @ للإشارة إلى عضو في المشروع",
  "No project member matches this name.": "لا يوجد عضو في المشروع بهذا الاسم.",
  "Viewers can read comments but cannot post.":
    "يمكن للمشاهدين قراءة التعليقات دون إضافتها.",

  // Tags
  Tags: "الوسوم",
  Tag: "الوسم",
  "All tags": "كل الوسوم",
  "No tags": "لا توجد وسوم",
  "Add tag": "إضافة وسم",
  "Add or reuse a tag": "أضف وسمًا جديدًا أو اختر وسمًا موجودًا",
  "Separate tags with commas": "افصل بين الوسوم بفواصل",
  "Tasks by tag": "المهام حسب الوسم",

  // Custom fields
  "Custom fields": "الحقول المخصصة",
  "Project-level fields shown in task details and the list view.":
    "حقول خاصة بالمشروع تظهر في تفاصيل المهمة وعرض القائمة.",
  "No custom fields yet.": "لا توجد حقول مخصصة بعد.",
  Edit: "تعديل",
  "Remove field and its values": "حذف الحقل وقيمه",
  "Field name": "اسم الحقل",
  Type: "النوع",
  "A field’s type cannot be changed after it is created.":
    "لا يمكن تغيير نوع الحقل بعد إنشائه.",
  Options: "الخيارات",
  "One option per line, or separated by commas":
    "خيار في كل سطر أو مفصولة بفواصل",
  "Tasks using a removed option are cleared.":
    "تُمسح القيمة من المهام التي تستخدم خيارًا محذوفًا.",
  "Add field": "إضافة حقل",
  "Save field": "حفظ الحقل",
  Text: "نص",
  Number: "رقم",
  Select: "قائمة اختيار",
  Date: "تاريخ",
  Field: "حقل",
  "Not set": "غير محدد",
  Any: "الكل",

  // Saved views
  Views: "طرق العرض",
  "Saved views": "طرق العرض المحفوظة",
  Default: "الافتراضي",
  "Unsaved changes": "تغييرات غير محفوظة",
  Customize: "تخصيص",
  "Update view": "تحديث العرض",
  "Save view": "حفظ العرض",
  "Delete view": "حذف العرض",
  "View name": "اسم العرض",
  "For example: Overdue, This week, Urgent":
    "مثال: المتأخرة، هذا الأسبوع، العاجلة",
  "Saves the current filters, sorting, grouping and columns. Only you can see your views.":
    "يحفظ الفلاتر والترتيب والتجميع والأعمدة الحالية. طرق العرض خاصة بك وحدك.",
  "Sort by": "الترتيب حسب",
  "Default order": "الترتيب الافتراضي",
  Direction: "الاتجاه",
  Ascending: "تصاعدي",
  Descending: "تنازلي",
  "Group by": "التجميع حسب",
  "No grouping": "بدون تجميع",
  Columns: "الأعمدة",
  "Reset layout": "إعادة ضبط التخطيط",
  Created: "تاريخ الإنشاء",
  Assignee: "المسؤول",
  Later: "لاحقًا",
  "All tasks": "كل المهام",

  // Workload
  Employee: "الموظف",
  Open: "مفتوحة",
  "Due soon": "تستحق قريبًا",
  Load: "العبء",
  "open tasks": "مهام مفتوحة",
  overdue: "متأخرة",
  overloaded: "مثقلون بالعمل",
  Overloaded: "محمل",
  Busy: "مشغول",
  "High load": "مرتفع",
  Balanced: "متوازن",
  Light: "خفيف",
  "Active tasks": "المهام النشطة",
  "Load level": "مستوى العبء",
  "Team total": "إجمالي الفريق",
  "Overdue tasks": "المهام المتأخرة",
  "All open tasks": "المهام المفتوحة",
  "Highest load": "أعلى ضغط",
  member: "عضو",
  task: "مهمة",
  "active task": "مهمة نشطة",
  "active tasks": "مهام نشطة",
  active: "نشطة",
  "Search for an employee...": "البحث عن موظف...",
  "All departments": "كل الأقسام",
  Period: "الفترة",
  "All time": "كل الأوقات",
  "This week": "هذا الأسبوع",
  "This month": "هذا الشهر",
  "Needs your attention": "يحتاج انتباهك",
  "Team members with overdue tasks or a high workload.":
    "أكثر أعضاء الفريق لديهم مهام متأخرة أو ضغط عمل مرتفع.",
  "No one needs attention right now.": "لا يوجد من يحتاج انتباهك حاليًا.",
  "View all team members": "عرض جميع أعضاء الفريق",
  "No matching employees": "لا يوجد موظفون مطابقون",
  "Try changing the search or filters.": "جرّب تغيير البحث أو عوامل التصفية.",
  "Counts use each person’s own part of shared tasks and only work visible to you. Due soon means the next 3 days. High load: any overdue task or 1.5× the team’s typical open tasks. Overloaded: 3+ overdue tasks or 2× the typical open tasks. Light: under 75% of the typical open tasks.":
    "تُحسب الأعداد من جزء كل شخص في المهام المشتركة ومن المهام الظاهرة لك فقط. «تستحق قريبًا» تعني الأيام الثلاثة القادمة. مرتفع: مهمة متأخرة واحدة على الأقل أو 1.5 ضعف المعتاد في الفريق. محمل: 3 مهام متأخرة أو أكثر أو ضعف المعتاد. خفيف: أقل من 75% من المعتاد.",

  // Sign-in
  "Sign in with your HR account to reach your workspace.":
    "سجّل الدخول بحساب الموارد البشرية للوصول إلى مساحة عملك.",
  "Remember me on this device": "تذكرني في هذا الجهاز",
  "Forgot password?": "نسيت كلمة المرور؟",
  "To reset your password, contact your HR administrator.":
    "لإعادة تعيين كلمة المرور، تواصل مع مسؤول الموارد البشرية.",
  "One account for TASK and HR": "حساب واحد لـ TASK و HR",
  "One place for work": "مكان واحد للعمل",
  "that matters.": "المهم.",
  "Manage projects, tasks, people and progress in one place, and achieve more with your team.":
    "إدارة المشاريع والمهام والأشخاص والتقدم في مكان واحد، لتحقيق نتائج أكبر مع فريقك.",

  // Server messages
  "Employee is not available from HR.": "الموظف غير متاح في نظام الموارد البشرية.",
  "Project not found.": "المشروع غير موجود.",
  "This project is archived. Restore it to make changes.":
    "هذا المشروع مؤرشف. استعده لإجراء تغييرات.",
  "Task not found.": "المهمة غير موجودة.",
  "Restore this task before making changes.":
    "استعد هذه المهمة قبل إجراء تغييرات.",
  "Milestone not found.": "المعلم غير موجود.",
  "Checklist limit reached.": "تم بلوغ الحد الأقصى لقائمة التحقق.",
  "Checklist item not found.": "عنصر التحقق غير موجود.",
  "Due date must follow start date.":
    "يجب أن يكون موعد التسليم بعد تاريخ البدء.",
  "Template not found.": "القالب غير موجود.",
  "Only the owner or an admin can change the project owner.":
    "يمكن للمالك أو مدير النظام فقط تغيير مالك المشروع.",
  "Choose a current project member as the new owner.":
    "اختر عضوًا حاليًا في المشروع مالكًا جديدًا.",
  "You can add only employees from the owner’s team or your own reports.":
    "يمكنك إضافة موظفين من فريق المالك أو من التابعين لك فقط.",
  "Only the owner or an admin can change project managers.":
    "يمكن للمالك أو مدير النظام فقط تغيير مديري المشروع.",
  "Reassign this member’s tasks before removing them.":
    "أعد إسناد مهام هذا العضو قبل إزالته.",
  "Reassign this member’s tasks before making them a viewer.":
    "أعد إسناد مهام هذا العضو قبل تحويله إلى مشاهد.",
  "Only project managers and admins can change project health.":
    "يمكن لمديري المشروع ومديري النظام فقط تغيير صحة المشروع.",
  "Only project managers and admins can archive projects.":
    "يمكن لمديري المشروع ومديري النظام فقط أرشفة المشاريع.",
  "This project is already archived.": "هذا المشروع مؤرشف بالفعل.",
  "Only project managers and admins can restore projects.":
    "يمكن لمديري المشروع ومديري النظام فقط استعادة المشاريع.",
  "This project is not archived.": "هذا المشروع غير مؤرشف.",
  "Only admins can delete permanently.":
    "يمكن لمديري النظام فقط الحذف النهائي.",
  "Archive this project before deleting it permanently.":
    "أرشف هذا المشروع قبل حذفه نهائيًا.",
  "Only project managers and admins can archive project tasks.":
    "يمكن لمديري المشروع ومديري النظام فقط أرشفة مهام المشروع.",
  "This task is already archived.": "هذه المهمة مؤرشفة بالفعل.",
  "Only project managers and admins can restore project tasks.":
    "يمكن لمديري المشروع ومديري النظام فقط استعادة مهام المشروع.",
  "Restore the project first.": "استعد المشروع أولًا.",
  "Restore the parent task first.": "استعد المهمة الرئيسية أولًا.",
  "This task is not archived.": "هذه المهمة غير مؤرشفة.",
  "Archive this task before deleting it permanently.":
    "أرشف هذه المهمة قبل حذفها نهائيًا.",
  "Only project managers and admins can manage custom fields.":
    "يمكن لمديري المشروع ومديري النظام فقط إدارة الحقول المخصصة.",
  "Field not found.": "الحقل غير موجود.",
  "A field’s type cannot be changed.": "لا يمكن تغيير نوع الحقل.",
  "Projects can have up to 30 custom fields.":
    "يمكن أن يضم المشروع 30 حقلًا مخصصًا كحد أقصى.",
  "Field must belong to the task’s project.":
    "يجب أن ينتمي الحقل إلى مشروع المهمة.",
  "Enter a valid number.": "أدخل رقمًا صحيحًا.",
  "Choose one of the field’s options.": "اختر أحد خيارات الحقل.",
  "Choose a project for this view.": "اختر مشروعًا لهذا العرض.",
  "Saved view not found.": "العرض المحفوظ غير موجود.",
  "You can keep up to 50 saved views.":
    "يمكنك الاحتفاظ بـ50 عرضًا محفوظًا كحد أقصى.",
  "Only managers and admins can create project templates.":
    "يمكن للمديرين ومديري النظام فقط إنشاء قوالب المشاريع.",
  "Only project managers and admins can create project templates.":
    "يمكن لمديري المشروع ومديري النظام فقط إنشاء قوالب المشاريع.",
  "Viewers cannot add tasks to this project.":
    "لا يمكن للمشاهدين إضافة مهام إلى هذا المشروع.",
  "Subtasks support one level in V1.":
    "تدعم المهام الفرعية مستوى واحدًا فقط في هذا الإصدار.",
  "Subtasks must use the parent project.":
    "يجب أن تكون المهمة الفرعية في مشروع المهمة الرئيسية.",
  "Only top-level tasks can repeat.": "يمكن تكرار المهام الرئيسية فقط.",
  "Recurring tasks need a due date.": "تحتاج المهام المتكررة إلى موعد تسليم.",
  "Section must belong to the project.": "يجب أن ينتمي القسم إلى المشروع.",
  "Only a project manager, the assigning manager, or an admin can reassign work.":
    "يمكن لمدير المشروع أو المدير المُسنِد أو مدير النظام فقط إعادة إسناد العمل.",
  "Complete your own part using the assignee controls.":
    "أكمل الجزء الخاص بك من خلال أدوات المسؤولين.",
  "You can complete only your own part.": "يمكنك إكمال الجزء الخاص بك فقط.",
  "Employee is not assigned.": "الموظف غير مسند إلى المهمة.",
  "Viewers can read this project but cannot comment.":
    "يمكن للمشاهدين قراءة هذا المشروع دون التعليق.",
  "You can mention only people who can see this task.":
    "يمكنك الإشارة فقط إلى من يستطيع رؤية هذه المهمة.",
  "Files must be between 1 byte and 10 MB.":
    "يجب أن يكون حجم الملف بين 1 بايت و10 ميجابايت.",
  "Attachment not found.": "المرفق غير موجود.",
  "Keep at least one TASK admin.": "يجب الإبقاء على مدير نظام واحد على الأقل.",
  "Choose at least one assignee.": "اختر مسؤولًا واحدًا على الأقل.",
  "Assignees must belong to the project.":
    "يجب أن يكون المسؤولون أعضاء في المشروع.",
  "Viewers cannot be assigned work.": "لا يمكن إسناد مهام إلى المشاهدين.",
  "Enter a valid calendar date.": "أدخل تاريخًا صحيحًا.",
  "Select fields need at least one option.":
    "تحتاج حقول قائمة الاختيار إلى خيار واحد على الأقل.",
  "You do not have permission to do this.": "ليست لديك صلاحية لتنفيذ ذلك.",
  "Something went wrong. Please try again.": "حدث خطأ ما. حاول مرة أخرى.",
};

// English phrasing for activity keys; the feed reads "<name> <phrase> <task>".
export const advancedEn: Record<string, string> = {
  "feed:project_created": "created the project",
  "feed:project_status_changed": "changed the project status",
  "feed:task_created": "created",
  "feed:task_completed": "completed",
  "feed:status_changed": "changed the status of",
  "feed:comment_created": "commented on",
  "feed:assignee_added": "assigned",
  "feed:assignee_removed": "unassigned",
  "feed:milestone_created": "created a milestone",
  "feed:milestone_updated": "updated a milestone",
  "feed:dependency_added": "added a dependency to",
  "feed:dependency_removed": "removed a dependency from",
  "feed:member_added": "added a member",
  "feed:member_removed": "removed a member",
  "feed:member_role_changed": "changed a member’s role",
  "feed:owner_changed": "changed the project owner",
  "feed:health_overridden": "set project health manually",
  "feed:health_override_cleared": "returned project health to automatic",
  "feed:project_archived": "archived the project",
  "feed:project_restored": "restored the project",
  "feed:project_deleted_permanently": "permanently deleted a project",
  "feed:task_archived": "archived",
  "feed:task_restored": "restored",
  "feed:task_deleted_permanently": "permanently deleted a task",
  "feed:recurrence_created": "created the next occurrence of",
  project_created: "Project created",
  project_status_changed: "Project status changed",
  member_added: "Member added",
  member_removed: "Member removed",
  member_role_changed: "Member role changed",
  owner_changed: "Project owner changed",
  health_overridden: "Project health set manually",
  health_override_cleared: "Project health returned to automatic",
  project_archived: "Project archived",
  project_restored: "Project restored",
  project_deleted_permanently: "Project deleted permanently",
  task_archived: "Task archived",
  task_restored: "Task restored",
  task_deleted_permanently: "Task deleted permanently",
  recurrence_created: "Next occurrence created",
  recurrence_stopped: "Recurrence stopped: no assignees are available",
  recurrence_changed: "Recurrence changed",
  tag_added: "Tag added",
  tag_removed: "Tag removed",
  field_created: "Custom field added",
  field_updated: "Custom field updated",
  field_removed: "Custom field removed",
  field_changed: "Field value changed",
  template_created: "Saved as a template",
};
