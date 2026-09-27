/* ===== Message Generator Module (topics x relationships) ===== */

const Generator = {
  // Birthday messages
  templates: {
    mom: {
      birthday: "Happy Birthday, {name}! Today is all about you, and I want you to know how much you mean to me. Your love, warmth, and endless support have shaped who I am today. May this year bring you all the happiness and joy you deserve. I love you more than words can say!",
      valentine: "Happy Valentine's Day, {name}! You are my first Valentine and my forever one. Your love raised me, and your heart still lights up our whole family.",
      anniversary: "Happy Anniversary, {name}! {years} Thank you for showing us what lasting love looks like. Wishing you many more beautiful years together.",
      thankYou: "Dear {name}, thank you from the bottom of my heart for {reason}. Your love has carried me through everything, and I am endlessly grateful for you.",
      justBecause: "Dear {name}, no special occasion - I just wanted you to know how deeply loved you are. You make every ordinary day feel special."
    },
    dad: {
      birthday: "Happy Birthday, {name}! You've been my hero since day one. Your strength, wisdom, and unconditional love have guided me through life. Today, I celebrate you and all that you are. I love you!",
      valentine: "Happy Valentine's Day, {name}! You showed me what real love is - strong, patient, and always there. I love you more than words can say.",
      anniversary: "Happy Anniversary, {name}! {years} Thank you for showing us what true commitment looks like. Wishing you endless joy together.",
      thankYou: "Dear {name}, thank you for {reason}. Your strength and guidance shaped who I am, and I appreciate you more than you'll ever know.",
      justBecause: "Dear {name}, just thinking of you today and feeling grateful. You are my hero, today and every day."
    },
    sister: {
      birthday: "Happy Birthday, {name}! Having a sister like you is one of life's greatest gifts. Through every laugh, every tear, and every adventure, you've been right there beside me. May your day be as wonderful as you are!",
      valentine: "Happy Valentine's Day, {name}! Life gave me a sister and a best friend in one person. I love you for {reason}.",
      anniversary: "Happy Anniversary, {name}! {years} So happy to see your love grow stronger every year. Wishing you a lifetime of laughter together.",
      thankYou: "Dear {name}, thank you for {reason}. Having you as my sister means having a friend for life, and I don't say it enough.",
      justBecause: "Dear {name}, just a little note to say you're amazing. Thanks for being my sister and my friend, always."
    },
    brother: {
      birthday: "Happy Birthday, {name}! Having a brother like you is one of life's greatest gifts. Through every laugh, every adventure, and every challenge, you've been right there beside me. May your day be as awesome as you are!",
      valentine: "Happy Valentine's Day, {name}! Thanks for a lifetime of laughs, loyalty, and brotherhood. I appreciate you for {reason}.",
      anniversary: "Happy Anniversary, {name}! {years} Wishing you many more adventures together.",
      thankYou: "Dear {name}, thank you for {reason}. You've always had my back, and that means the world to me.",
      justBecause: "Dear {name}, no reason at all - just wanted to say you're awesome and I'm glad you're my brother."
    },
    aunt: {
      birthday: "Happy Birthday, {name}! You're not just an aunt, you're a second mom, a mentor, and a friend. Your love and guidance have meant so much to me over the years. Wishing you a day as special as you are!",
      valentine: "Happy Valentine's Day, {name}! Your kindness and warmth make everyone feel loved. So grateful for you and for {reason}.",
      anniversary: "Happy Anniversary, {name}! {years} Your beautiful journey together inspires everyone around you.",
      thankYou: "Dear {name}, thank you for {reason}. Your generosity and warmth never go unnoticed - I'm so lucky to have you.",
      justBecause: "Dear {name}, sending you love today for no reason at all. You deserve to be celebrated every single day."
    },
    friend: {
      birthday: "Happy Birthday, {name}! Friends like you are rare and precious. Thank you for all the laughs, the support, and the unforgettable moments. Here's to another amazing year of friendship!",
      valentine: "Happy Valentine's Day, {name}! Friends like you turn ordinary days into celebrations. So glad to have you, and I admire you for {reason}.",
      anniversary: "Happy Anniversary, {name}! {years} Cheers to your love story - may each chapter be better than the last.",
      thankYou: "Dear {name}, thank you for {reason}. True friends are rare, and you are one of the very best.",
      justBecause: "Dear {name}, just wanted to remind you how great you are. Thanks for being you - never change."
    },
    husband: {
      birthday: "Happy Birthday, {name}! Thank you for being my partner, my strength, and my best friend. Today we celebrate you and everything you are. I love you!",
      valentine: "Happy Valentine's Day, my love! {reason} Every day with you is a gift, and my heart chooses you over and over again.",
      anniversary: "Happy Anniversary, my love! {years} Every year with you is my favorite chapter. Here's to us - today, tomorrow, always.",
      thankYou: "My dearest {name}, thank you for {reason}. Your love and support mean the world to me. I'm so lucky to walk through life with you.",
      justBecause: "My love, {name}, just wanted to remind you how deeply you are loved. You are my heart, my home, and my happiness."
    },
    wife: {
      birthday: "Happy Birthday, {name}! You fill our lives with love, warmth, and beauty. Today is all about celebrating the amazing woman you are. I love you!",
      valentine: "Happy Valentine's Day, my love! {reason} You are the most beautiful part of my every day. My heart is yours, completely.",
      anniversary: "Happy Anniversary, my love! {years} Loving you is the easiest thing I've ever done. Here's to forever, together.",
      thankYou: "My dearest {name}, thank you for {reason}. Your love makes our house a home and every day brighter. I appreciate you endlessly.",
      justBecause: "My love, {name}, just wanted you to know you are cherished beyond words. Thank you for being you."
    },
    boyfriend: {
      birthday: "Happy Birthday, {name}! Thank you for being the most amazing boyfriend - your love, laughter, and support mean everything to me. Today we celebrate you!",
      valentine: "Happy Valentine's Day, my love! {reason} You make my heart skip a beat every single day. I'm so lucky you're mine.",
      anniversary: "Happy Anniversary, my love! {years} Every moment with you is my favorite memory. Here's to many more beautiful years together.",
      thankYou: "My dearest {name}, thank you for {reason}. Having you by my side makes everything better. I appreciate you more than you know.",
      justBecause: "Hey {name}, just thinking of you and smiling. You make my days brighter just by being you."
    },
    girlfriend: {
      birthday: "Happy Birthday, {name}! Thank you for being the most amazing girlfriend - your smile lights up my world. Today is all about celebrating you!",
      valentine: "Happy Valentine's Day, my love! {reason} You are the best part of every day. My heart belongs to you, today and always.",
      anniversary: "Happy Anniversary, my love! {years} Loving you gets easier and more wonderful with every passing day. Here's to us.",
      thankYou: "My dearest {name}, thank you for {reason}. Your love and care mean the world to me. I'm the luckiest to have you.",
      justBecause: "Hey {name}, just wanted you to know you're on my mind. You make everything better simply by being you."
    },
    other: {
      birthday: "Happy Birthday, {name}! Today is all about you. Thank you for being such a special part of my life - your kindness, laughter, and warmth mean more than you know. May this year bring you everything you deserve and more!",
      valentine: "Happy Valentine's Day, {name}! Wishing you a day full of love and sweetness. You deserve it all, especially for {reason}.",
      anniversary: "Happy Anniversary, {name}! {years} Wishing you both a day as beautiful as your journey together.",
      thankYou: "Dear {name}, thank you for {reason}. Your kindness made a real difference, and I will never forget it.",
      justBecause: "Dear {name}, just thinking of you and wanted to send some warmth your way. Hope today brings you a smile."
    }
  },

  // Arabic messages
  templatesAr: {
    mom: {
      birthday: "عيد ميلاد سعيد يا {name}! اليوم يومك، وأريدكِ أن تعرفي كم أنتِ غالية عليّ. بحبك وحنانك ودعمك الدائم صرتُ ما أنا عليه اليوم. أتمنى لكِ عامًا مليئًا بالسعادة والفرح الذي تستحقينه. أحبكِ أكثر من الكلمات!",
      valentine: "عيد حب سعيد يا {name}! أنتِ أول حب عرفته في حياتي وستبقين دائمًا. حبك ربّاني وقلبك ما زال ينير عائلتنا كلها.",
      anniversary: "ذكرى سعيدة يا {name}! {years} شكرًا لأنكما أريتمانا معنى الحب الدائم. إلى سنوات أخرى كثيرة من السعادة.",
      thankYou: "عزيزتي {name}، شكرًا من أعماق قلبي على {reason}. حبك حملني في كل شيء، وأنا ممتن لك دائمًا.",
      justBecause: "عزيزتي {name}، بدون مناسبة - أردت فقط أن تعرفي كم أنتِ محبوبة. تجعلين كل يوم عادي مميزًا."
    },
    dad: {
      birthday: "عيد ميلاد سعيد يا {name}! كنت بطلي منذ اليوم الأول. قوتك وحكمتك وحبك غير المشروط قادوني في الحياة. اليوم أحتفل بك وبكل ما أنت عليه. أحبك!",
      valentine: "عيد حب سعيد يا {name}! علمتني ما هو الحب الحقيقي - قوي وصبور ودائم. أحبك أكثر مما تعبر عنه الكلمات.",
      anniversary: "ذكرى سعيدة يا {name}! {years} شكرًا لأنك أريتنا معنى الالتزام الحقيقي. أتمنى لكما فرحًا لا ينتهي.",
      thankYou: "عزيزي {name}، شكرًا على {reason}. قوتك وإرشادك صنعا من أنا عليه، وأقدّرك أكثر مما تعرف.",
      justBecause: "عزيزي {name}، أفكر فيك اليوم وممتن. أنت بطلي، اليوم وكل يوم."
    },
    sister: {
      birthday: "عيد ميلاد سعيد يا {name}! وجود أخت مثلك من أعظم هدايا الحياة. في كل ضحكة ودمعة ومغامرة، كنتِ بجانبي دائمًا. أتمنى لكِ يومًا رائعًا مثلك تمامًا!",
      valentine: "عيد حب سعيد يا {name}! الحياة أعطتني أختًا وصديقة في شخص واحد. أحبكِ لـ{reason}.",
      anniversary: "ذكرى سعيدة يا {name}! {years} سعيد برؤية حبكما يكبر كل سنة. أتمنى لكما عمرًا من الضحك معًا.",
      thankYou: "عزيزتي {name}، شكرًا على {reason}. وجودك كأخت يعني صديقة للعمر، ولا أقولها كفاية.",
      justBecause: "عزيزتي {name}، رسالة صغيرة لتقولي إنك رائعة. شكرًا لكونك أختي وصديقتي دائمًا."
    },
    brother: {
      birthday: "عيد ميلاد سعيد يا {name}! وجود أخ مثلك من أعظم هدايا الحياة. في كل ضحكة ومغامرة وتحدٍّ، كنت بجانبي دائمًا. أتمنى لك يومًا رائعًا مثلك!",
      valentine: "عيد حب سعيد يا {name}! شكرًا على عمر من الضحك والوفاء والأخوة. أقدّرك لـ{reason}.",
      anniversary: "ذكرى سعيدة يا {name}! {years} أتمنى لكما مغامرات أخرى كثيرة معًا.",
      thankYou: "عزيزي {name}، شكرًا على {reason}. كنت دائمًا سندي، وهذا يعني لي العالم.",
      justBecause: "عزيزي {name}، بدون سبب - أردت فقط أن أقول إنك رائع وسعيد لأنك أخي."
    },
    aunt: {
      birthday: "عيد ميلاد سعيد يا {name}! أنتِ لست خالة فقط، بل أم ثانية ومرشدة وصديقة. حبك وتوجيهك على مر السنين يعني لي الكثير. أتمنى لكِ يومًا مميزًا مثلك!",
      valentine: "عيد حب سعيد يا {name}! لطفك ودفئك يجعلان كل من حولك يشعر بالحب. ممتن لكِ ولكل {reason}.",
      anniversary: "ذكرى سعيدة يا {name}! {years} رحلتكما الجميلة معًا تلهمان كل من حولكما.",
      thankYou: "عزيزتي {name}، شكرًا على {reason}. كرمك ودفئك لا يمران دون تقدير - محظوظ بوجودك.",
      justBecause: "عزيزتي {name}، أرسل لك الحب اليوم بدون سبب. تستحقين الاحتفال كل يوم."
    },
    friend: {
      birthday: "عيد ميلاد سعيد يا {name}! صديق رائع مثلك نادر وثمين. شكرًا على كل الضحكات والدعم واللحظات التي لا تُنسى. إلى سنة أخرى رائعة من الصداقة!",
      valentine: "عيد حب سعيد يا {name}! أصدقاء مثلك يحوّلون الأيام العادية إلى احتفالات. سعيد بوجودك وأعجب بـ{reason}.",
      anniversary: "ذكرى سعيدة يا {name}! {years} تحية لقصة حبكما - لتكن كل صفحة أجمل من التي قبلها.",
      thankYou: "عزيزي {name}، شكرًا على {reason}. الأصدقاء الحقيقيون نادرون، وأنت من أفضلهم.",
      justBecause: "عزيزي {name}، أردت فقط أن أذكرك كم أنت رائع. شكرًا لكونك أنت - لا تتغير أبدًا."
    },
    husband: {
      birthday: "عيد ميلاد سعيد يا {name}! شكرًا لكونك شريكي وسندي وأعز أصدقائي. اليوم نحتفل بك وبكل ما أنت عليه. أحبك!",
      valentine: "عيد حب سعيد يا حبيبي! {reason} كل يوم معك هدية، وقلبي يختارك مرارًا وتكرارًا.",
      anniversary: "ذكرى سعيدة يا حبيبي! {years} كل سنة معك هي فصلي المفضل. لنا - اليوم وغدًا ودائمًا.",
      thankYou: "يا أغلى {name}، شكرًا على {reason}. حبك ودعمك يعنيان لي العالم. محظوظ أن أمشي في الحياة معك.",
      justBecause: "يا حبيبي {name}، أردت فقط أن أذكرك كم أنت محبوب بعمق. أنت قلبي وبيتي وسعادتي."
    },
    wife: {
      birthday: "عيد ميلاد سعيد يا {name}! تملئين حياتنا حبًا ودفئًا وجمالًا. اليوم كله للاحتفال بالمرأة الرائعة التي أنتِ. أحبك!",
      valentine: "عيد حب سعيد يا حبيبتي! {reason} أنتِ أجمل جزء في كل يوم. قلبي لكِ بالكامل.",
      anniversary: "ذكرى سعيدة يا حبيبتي! {years} حبك أسهل شيء فعلته. إلى الأبد معًا.",
      thankYou: "يا أغلى {name}، شكرًا على {reason}. حبك يجعل بيتنا بيتًا وكل يوم أجمل. أقدّرك بلا حدود.",
      justBecause: "يا حبيبتي {name}، أردت فقط أن تعرفي أنك عزيزة أكثر من الكلمات. شكرًا لكونك أنتِ."
    },
    boyfriend: {
      birthday: "عيد ميلاد سعيد يا {name}! شكرًا لكونك أروع حبيب - حبك وضحكتك ودعمك يعنون لي كل شيء. اليوم نحتفل بك!",
      valentine: "عيد حب سعيد يا حبيبي! {reason} تجعل قلبي يخفق كل يوم. كم أنا محظوظ بك.",
      anniversary: "ذكرى سعيدة يا حبيبي! {years} كل لحظة معك هي أجمل ذكرياتي. إلى سنوات أخرى كثيرة معًا.",
      thankYou: "يا أغلى {name}، شكرًا على {reason}. وجودك بجانبي يجعل كل شيء أفضل. أقدّرك أكثر مما تعرف.",
      justBecause: "يا {name}، أفكر فيك وأبتسم. تجعل أيامي أجمل بمجرد وجودك."
    },
    girlfriend: {
      birthday: "عيد ميلاد سعيد يا {name}! شكرًا لكونك أروع حبيبة - ابتسامتك تنير عالمي. اليوم كله للاحتفال بك!",
      valentine: "عيد حب سعيد يا حبيبتي! {reason} أنتِ أفضل جزء في كل يوم. قلبي لكِ اليوم ودائمًا.",
      anniversary: "ذكرى سعيدة يا حبيبتي! {years} حبك يزداد سهولة وجمالًا كل يوم. لنا معًا.",
      thankYou: "يا أغلى {name}، شكرًا على {reason}. حبك واهتمامك يعنيان لي العالم. أنا محظوظ بك.",
      justBecause: "يا {name}، أردت فقط أن تعرفي أنك في بالي. تجعلين كل شيء أفضل بمجرد وجودك."
    },
    other: {
      birthday: "عيد ميلاد سعيد يا {name}! اليوم كله لك. شكرًا لكونك جزءًا مميزًا من حياتي - لطفك وضحكتك ودفئك يعنون لي أكثر مما تعرف. أتمنى لك سنة تحقق لك كل ما تستحق وأكثر!",
      valentine: "عيد حب سعيد يا {name}! أتمنى لك يومًا مليئًا بالحب والحلاوة. تستحق كل جميل، خصوصًا لـ{reason}.",
      anniversary: "ذكرى سعيدة يا {name}! {years} أتمنى لكما يومًا بجمال رحلتكما معًا.",
      thankYou: "عزيزي {name}، شكرًا على {reason}. لطفك صنع فرقًا حقيقيًا ولن أنساه أبدًا.",
      justBecause: "عزيزي {name}، أفكر فيك وأردت أن أرسل بعض الدفء. أتمنى أن يجلب لك اليوم ابتسامة."
    }
  },

  greetings: {
    mom: {
      birthday: `Happy Birthday, dear {name}!`,
      valentine: `Happy Valentine's Day, my dearest {name}!`,
      anniversary: `Happy Anniversary, dear {name}!`,
      thankYou: `Thank You, Mom`,
      justBecause: `Thinking of You, {name}`
    },
    sister: {
      birthday: `Happy Birthday, {name}!`,
      valentine: `Happy Valentine's Day, {name}!`,
      anniversary: `Happy Anniversary, {name}!`,
      thankYou: `Thank You, {name}`,
      justBecause: `Hey {name}!`
    },
    aunt: {
      birthday: `Happy Birthday, {name}!`,
      valentine: `Happy Valentine's Day, {name}!`,
      anniversary: `Happy Anniversary, {name}!`,
      thankYou: `Thank You, {name}`,
      justBecause: `Thinking of You, {name}`
    },
    dad: {
      birthday: `Happy Birthday, {name}!`,
      valentine: `Happy Valentine's Day, {name}!`,
      anniversary: `Happy Anniversary, {name}!`,
      thankYou: `Thank You, Dad`,
      justBecause: `Hey {name}!`
    },
    friend: {
      birthday: `Happy Birthday, {name}!`,
      valentine: `Happy Valentine's Day, {name}!`,
      anniversary: `Happy Anniversary, {name}!`,
      thankYou: `Thank You, {name}`,
      justBecause: `Hey {name}!`
    },
    brother: {
      birthday: `Happy Birthday, {name}!`,
      valentine: `Happy Valentine's Day, {name}!`,
      anniversary: `Happy Anniversary, {name}!`,
      thankYou: `Thank You, {name}`,
      justBecause: `Hey {name}!`
    },
    husband: {
      birthday: `Happy Birthday, {name}!`,
      valentine: `Happy Valentine's Day, my love!`,
      anniversary: `Happy Anniversary, my love!`,
      thankYou: `Thank You, my love`,
      justBecause: `My Dearest {name}`
    },
    wife: {
      birthday: `Happy Birthday, {name}!`,
      valentine: `Happy Valentine's Day, my love!`,
      anniversary: `Happy Anniversary, my love!`,
      thankYou: `Thank You, my love`,
      justBecause: `My Dearest {name}`
    },
    boyfriend: {
      birthday: `Happy Birthday, {name}!`,
      valentine: `Happy Valentine's Day, my love!`,
      anniversary: `Happy Anniversary, my love!`,
      thankYou: `Thank You, my love`,
      justBecause: `Thinking of You, {name}`
    },
    girlfriend: {
      birthday: `Happy Birthday, {name}!`,
      valentine: `Happy Valentine's Day, my love!`,
      anniversary: `Happy Anniversary, my love!`,
      thankYou: `Thank You, my love`,
      justBecause: `Thinking of You, {name}`
    },
    other: {
      birthday: `Happy Birthday, {name}!`,
      valentine: `Happy Valentine's Day, {name}!`,
      anniversary: `Happy Anniversary, {name}!`,
      thankYou: `Thank You, {name}`,
      justBecause: `Just For You, {name}`
    }
  },

  greetingsAr: {
    mom: {
      birthday: "عيد ميلاد سعيد يا أغلى {name}!",
      valentine: "عيد حب سعيد يا أغلى {name}!",
      anniversary: "ذكرى سعيدة يا غاليتي {name}!",
      thankYou: "شكرًا لك يا أمي",
      justBecause: "أفكر فيك يا {name}"
    },
    sister: {
      birthday: "عيد ميلاد سعيد يا {name}!",
      valentine: "عيد حب سعيد يا {name}!",
      anniversary: "ذكرى سعيدة يا {name}!",
      thankYou: "شكرًا لك يا {name}",
      justBecause: "أهلًا {name}!"
    },
    aunt: {
      birthday: "عيد ميلاد سعيد يا {name}!",
      valentine: "عيد حب سعيد يا {name}!",
      anniversary: "ذكرى سعيدة يا {name}!",
      thankYou: "شكرًا لك يا {name}",
      justBecause: "أفكر فيك يا {name}"
    },
    dad: {
      birthday: "عيد ميلاد سعيد يا {name}!",
      valentine: "عيد حب سعيد يا {name}!",
      anniversary: "ذكرى سعيدة يا {name}!",
      thankYou: "شكرًا لك يا أبي",
      justBecause: "أهلًا {name}!"
    },
    friend: {
      birthday: "عيد ميلاد سعيد يا {name}!",
      valentine: "عيد حب سعيد يا {name}!",
      anniversary: "ذكرى سعيدة يا {name}!",
      thankYou: "شكرًا لك يا {name}",
      justBecause: "أهلًا {name}!"
    },
    brother: {
      birthday: "عيد ميلاد سعيد يا {name}!",
      valentine: "عيد حب سعيد يا {name}!",
      anniversary: "ذكرى سعيدة يا {name}!",
      thankYou: "شكرًا لك يا {name}",
      justBecause: "أهلًا {name}!"
    },
    husband: {
      birthday: "عيد ميلاد سعيد يا {name}!",
      valentine: "عيد حب سعيد يا حبيبي!",
      anniversary: "ذكرى سعيدة يا حبيبي!",
      thankYou: "شكرًا لك يا حبيبي",
      justBecause: "يا أعز {name}"
    },
    wife: {
      birthday: "عيد ميلاد سعيد يا {name}!",
      valentine: "عيد حب سعيد يا حبيبتي!",
      anniversary: "ذكرى سعيدة يا حبيبتي!",
      thankYou: "شكرًا لك يا حبيبتي",
      justBecause: "يا أعز {name}"
    },
    boyfriend: {
      birthday: "عيد ميلاد سعيد يا {name}!",
      valentine: "عيد حب سعيد يا حبيبي!",
      anniversary: "ذكرى سعيدة يا حبيبي!",
      thankYou: "شكرًا لك يا حبيبي",
      justBecause: "أفكر فيك يا {name}"
    },
    girlfriend: {
      birthday: "عيد ميلاد سعيد يا {name}!",
      valentine: "عيد حب سعيد يا حبيبتي!",
      anniversary: "ذكرى سعيدة يا حبيبتي!",
      thankYou: "شكرًا لك يا حبيبتي",
      justBecause: "أفكر فيك يا {name}"
    },
    other: {
      birthday: "عيد ميلاد سعيد يا {name}!",
      valentine: "عيد حب سعيد يا {name}!",
      anniversary: "ذكرى سعيدة يا {name}!",
      thankYou: "شكرًا لك يا {name}",
      justBecause: "هذه لك يا {name}"
    }
  },

  footers: {
    mom: "With all my love, your child",
    sister: "With love, your sibling",
    aunt: "With love and gratitude",
    dad: "With all my love, your child",
    friend: "With love, your friend",
    brother: "With love, your sibling",
    husband: "Forever yours",
    wife: "Forever yours",
    boyfriend: "Forever yours",
    girlfriend: "Forever yours",
    other: "With lots of love"
  },

  footersAr: {
    mom: "بحبك يا أمي",
    sister: "بحبك يا أختي",
    aunt: "بحبك يا خالتي",
    dad: "بحبك يا أبي",
    friend: "مع حبي، صديقك",
    brother: "بحبك يا أخي",
    husband: "لك إلى الأبد",
    wife: "لكِ إلى الأبد",
    boyfriend: "لك إلى الأبد",
    girlfriend: "لكِ إلى الأبد",
    other: "مع كل الحب"
  },

  isAr(data) {
    return data && data.lang === 'ar';
  },

  // Generate a message based on relationship + occasion
  generateMessage(data) {
    const { relationship, occasion, name, fields } = data;
    const occ = occasion || 'birthday';
    const table = this.isAr(data) ? this.templatesAr : this.templates;
    const rel = table[relationship] || {};
    const template = rel[occ] || rel.birthday;

    if (!template) {
      return this.isAr(data)
        ? `عيد ميلاد سعيد يا ${name}! أتمنى لك يومًا رائعًا مليئًا بالحب والضحك وكل ما تستحق.`
        : `Happy Birthday, ${name}! Wishing you a wonderful day filled with love, laughter, and everything you deserve.`;
    }

    const f = fields || {};
    const reasonDefaults = this.isAr(data)
      ? { valentine: 'كل ما فيك من جمال', thankYou: 'كل ما قدمته' }
      : { valentine: 'everything you are', thankYou: 'everything you do' };
    const reason = (f.reason && f.reason.trim()) ? f.reason.trim() : (reasonDefaults[occ] || '');
    let message = template.replace(/{name}/g, name).replace(/{reason}/g, reason);

    if (occ === 'anniversary') {
      const y = parseInt(f.years, 10);
      const yearsText = (!isNaN(y) && y > 0)
        ? (this.isAr(data) ? `الاحتفال بـ${y} سنوات رائعة معًا.` : `Celebrating ${y} wonderful year${y > 1 ? 's' : ''} together.`)
        : '';
      message = message.replace(/{years}/g, yearsText);
    }

    return message.replace(/\s{2,}/g, ' ').trim();
  },

  // Get greeting based on relationship + occasion
  getGreeting(data) {
    const { relationship, occasion, name } = data;
    const occ = occasion || 'birthday';
    const table = this.isAr(data) ? this.greetingsAr : this.greetings;
    const rel = table[relationship] || {};
    const greeting = rel[occ] || rel.birthday;
    if (!greeting) {
      return this.isAr(data) ? `عيد ميلاد سعيد يا ${name}!` : `Happy Birthday, ${name}!`;
    }
    return greeting.replace(/{name}/g, name);
  },

  // Get footer text
  getFooter(data) {
    const { relationship } = data;
    if (this.isAr(data)) {
      return this.footersAr[relationship] || "مع حبي";
    }
    return this.footers[relationship] || "With love";
  },

  // Calculate birthday info
  getBirthdayInfo(dob) {
    if (!dob) return null;
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    const nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (nextBirthday < startOfToday) {
      nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);
    }
    const daysUntil = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));
    return { age, daysUntil, nextBirthday };
  },

  // Get details line for display (birthday countdown / anniversary)
  getOccasionDetails(data) {
    const occ = data.occasion || 'birthday';
    const fields = data.fields || {};
    const ar = this.isAr(data);
    if (occ === 'birthday' && fields.dob) {
      const info = this.getBirthdayInfo(fields.dob);
      if (info) {
        if (ar) {
          return `سيُتم ${info.age + 1} سنوات! ${info.daysUntil === 0 ? 'اليوم هو اليوم!' : 'باقي ' + info.daysUntil + ' يوم على اليوم الكبير!'}`;
        }
        return `Turning ${info.age + 1}! ${info.daysUntil === 0 ? 'Today is the day!' : info.daysUntil + ' days until the big day!'}`;
      }
    }
    if (occ === 'anniversary') {
      const y = parseInt(fields.years, 10);
      if (!isNaN(y) && y > 0) {
        return ar ? `الاحتفال بـ${y} سنوات معًا!` : `Celebrating ${y} year${y > 1 ? 's' : ''} together!`;
      }
      if (fields.anniversaryDate) {
        try {
          const d = new Date(fields.anniversaryDate).toLocaleDateString(ar ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          return ar ? `منذ ${d}` : `Celebrating since ${d}`;
        } catch (e) { /* fall through */ }
      }
    }
    return '';
  }
};

window.Generator = Generator;
