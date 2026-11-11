plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Where the release app loads the TV screen from. Override with -PKARIBU_BASE_URL=https://your-domain
val baseUrl = (findProperty("KARIBU_BASE_URL") as String?) ?: "https://tv.mrserengeti.com"
val appVersionCode = ((findProperty("KARIBU_VERSION_CODE") as String?) ?: "1").toInt()
val appVersionName = (findProperty("KARIBU_VERSION_NAME") as String?) ?: "1.0.0"

android {
    namespace = "tv.karibu.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "tv.karibu.app"
        minSdk = 24
        targetSdk = 35
        versionCode = appVersionCode
        versionName = appVersionName
    }

    // Release signing from environment variables (set as GitHub secrets). Keep the same keystore forever:
    // Android only installs updates signed with the key the app was first installed with.
    val ks = System.getenv("KARIBU_KEYSTORE_FILE")
    signingConfigs {
        if (ks != null && file(ks).exists()) {
            create("release") {
                storeFile = file(ks)
                storePassword = System.getenv("KARIBU_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KARIBU_KEY_ALIAS")
                keyPassword = System.getenv("KARIBU_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            // The Android TV emulator reaches your computer's Vite dev server at 10.0.2.2.
            buildConfigField("String", "TV_URL", "\"http://10.0.2.2:5173/tv\"")
            buildConfigField("String", "CONFIG_URL", "\"http://10.0.2.2:5173/tv-app.json\"")
            resValue("bool", "allow_cleartext", "true")
        }
        release {
            buildConfigField("String", "TV_URL", "\"$baseUrl/tv\"")
            // Optional JSON with {"min_app_version", "apk_url"} for update prompts; leave empty to skip.
            buildConfigField("String", "CONFIG_URL", "\"$baseUrl/tv-app.json\"")
            resValue("bool", "allow_cleartext", "false")
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.webkit:webkit:1.12.1")
}
