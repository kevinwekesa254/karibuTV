plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "tv.karibu.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "tv.karibu.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        debug {
            // The Android TV emulator reaches your computer's Vite dev server at 10.0.2.2.
            buildConfigField("String", "TV_URL", "\"http://10.0.2.2:5173/tv\"")
            buildConfigField("String", "CONFIG_URL", "\"http://10.0.2.2:5173/tv-app.json\"")
            resValue("bool", "allow_cleartext", "true")
        }
        release {
            buildConfigField("String", "TV_URL", "\"https://karibu.tv/tv\"")
            // Optional JSON with {"min_app_version", "apk_url"} for update prompts; leave empty to skip.
            buildConfigField("String", "CONFIG_URL", "\"https://karibu.tv/tv-app.json\"")
            resValue("bool", "allow_cleartext", "false")
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
