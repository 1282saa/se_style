/**
 * 소셜 미디어 기능 테스트 스크립트
 * .env 파일에 다음 환경 변수 설정 필요:
 * - INSTAGRAM_ACCESS_TOKEN
 * - INSTAGRAM_USER_ID
 * - THREAD_ACCESS_TOKEN
 * - THREAD_USER_ID
 */
require("dotenv").config();
const InstagramService = require("./src/services/social/instagramService");
const ThreadService = require("./src/services/social/threadService");
const mongoose = require("mongoose");
const SocialAccount = require("./src/models/socialAccount.model");
const SocialPost = require("./src/models/socialPost.model");
const SocialMediaService = require("./src/services/socialMediaService");

// 테스트 모드 설정
const TEST_MODE = {
  CHECK_TOKEN: true, // 토큰 정보 확인
  LIST_MEDIA: true, // 미디어 조회
  GENERATE_POST: false, // 게시물 생성 (DB에만 저장)
  PUBLISH_POST: false, // 실제 게시 (주의: 실제 계정에 게시됨)
  FETCH_STATISTICS: true, // 통계 데이터 조회
  USE_MOCK_DATA: true, // DB 연결 없이 모의 데이터 사용
};

// MongoDB 연결 (TEST_MODE.USE_MOCK_DATA가 false인 경우에만 사용)
async function connectDB() {
  if (TEST_MODE.USE_MOCK_DATA) return;

  try {
    await mongoose.connect(
      process.env.MONGODB_URI ||
        "mongodb://localhost:27017/proofreading-service"
    );
    console.log("MongoDB 연결 성공");
  } catch (error) {
    console.error("MongoDB 연결 실패:", error);
    process.exit(1);
  }
}

// Mock 사용자 ID (테스트용)
const TEST_USER_ID = "test_user_123";

/**
 * Instagram API 기능 테스트
 */
async function testInstagram() {
  console.log("\n===== Instagram API 테스트 =====");

  try {
    if (!process.env.INSTAGRAM_ACCESS_TOKEN || !process.env.INSTAGRAM_USER_ID) {
      console.error(
        "❌ INSTAGRAM_ACCESS_TOKEN 또는 INSTAGRAM_USER_ID가 설정되지 않았습니다."
      );
      console.error("   .env 파일에 다음 환경 변수를 설정해주세요:");
      console.error("   INSTAGRAM_ACCESS_TOKEN=your_access_token_here");
      console.error("   INSTAGRAM_USER_ID=your_instagram_business_account_id");
      return;
    }

    // Instagram 서비스 인스턴스 생성
    const instagramService = new InstagramService({
      accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
      platformUserId: process.env.INSTAGRAM_USER_ID,
    });

    // 1. 토큰 정보 확인
    if (TEST_MODE.CHECK_TOKEN) {
      console.log("📝 Instagram 액세스 토큰 정보 확인 중...");
      try {
        const tokenInfo = await instagramService.checkAccessToken();
        console.log("✅ 토큰 정보 확인 완료");
        console.log("   - 앱 ID:", tokenInfo.app_id);
        if (tokenInfo.expires_at) {
          const expiryDate = new Date(tokenInfo.expires_at * 1000);
          console.log("   - 만료일:", expiryDate.toLocaleString());

          // 만료 임박 경고
          const now = new Date();
          const daysLeft = Math.round(
            (expiryDate - now) / (1000 * 60 * 60 * 24)
          );
          if (daysLeft < 7) {
            console.warn(`⚠️ 주의: 토큰이 ${daysLeft}일 후에 만료됩니다!`);
          }
        } else {
          console.log("   - 만료일: 영구 토큰");
        }
        console.log(
          "   - 권한:",
          tokenInfo.scopes ? tokenInfo.scopes.join(", ") : "권한 정보 없음"
        );
      } catch (error) {
        console.error("❌ 토큰 정보 확인 실패:", error.message);
      }
    }

    // 2. 미디어 목록 조회
    if (TEST_MODE.LIST_MEDIA) {
      console.log("\n📝 Instagram 미디어 목록 조회 중...");
      try {
        const mediaItems = await instagramService.getMedia(5);
        console.log(`✅ ${mediaItems.length}개 미디어 항목 조회 완료`);

        if (mediaItems.length > 0) {
          console.log("\n📊 미디어 항목 요약:");
          mediaItems.forEach((item, index) => {
            console.log(`   ${index + 1}. ID: ${item.id}`);
            console.log(`      유형: ${item.media_type}`);
            console.log(`      URL: ${item.permalink}`);
            console.log(
              `      게시일: ${new Date(item.timestamp).toLocaleString()}`
            );
            console.log(
              `      캡션: ${
                item.caption
                  ? item.caption.substring(0, 50) + "..."
                  : "(캡션 없음)"
              }`
            );
            console.log("");
          });
        }
      } catch (error) {
        console.error("❌ 미디어 목록 조회 실패:", error.message);
      }
    }

    // 3. 통계 정보 조회
    if (TEST_MODE.FETCH_STATISTICS) {
      console.log("\n📝 Instagram 통계 정보 조회 중...");
      try {
        const stats = await instagramService.getUserStatistics();
        console.log("✅ 통계 정보 조회 완료");
        console.log("   - 총 게시물 수:", stats.total_posts);
        console.log("   - 게시물 유형:");
        Object.entries(stats.post_types).forEach(([type, count]) => {
          console.log(`     · ${type}: ${count}개`);
        });

        if (stats.popular_hashtags && stats.popular_hashtags.length > 0) {
          console.log("   - 인기 해시태그:");
          stats.popular_hashtags.forEach(([tag, count]) => {
            console.log(`     · #${tag}: ${count}회`);
          });
        }

        if (stats.peak_posting_hours && stats.peak_posting_hours.length > 0) {
          console.log("   - 인기 게시 시간대:");
          stats.peak_posting_hours.forEach(([hour, count]) => {
            console.log(`     · ${hour}시: ${count}회`);
          });
        }
      } catch (error) {
        console.error("❌ 통계 정보 조회 실패:", error.message);
      }
    }

    // 4. 게시물 생성 및 게시 테스트 (실제 게시 주의!)
    if (TEST_MODE.PUBLISH_POST) {
      console.log(
        "\n⚠️ Instagram 게시 테스트를 시작합니다. 실제 계정에 게시됩니다!"
      );
      console.log("   5초 내에 Ctrl+C를 눌러 취소할 수 있습니다...");

      await new Promise((resolve) => setTimeout(resolve, 5000));

      try {
        const caption =
          "테스트 게시물입니다. 자동화된 테스트에 의해 생성되었습니다. #테스트 #개발";

        // 접근 가능한 이미지 URL (테스트용)
        const imageUrl =
          "https://via.placeholder.com/1080x1080.png?text=Test+Post";

        console.log("📝 Instagram에 게시 중...");
        const result = await instagramService.publish(caption, imageUrl);

        console.log("✅ 게시 완료!");
        console.log("   - 게시물 ID:", result.id);
        console.log("   - 게시물 URL:", result.permalink || "(URL 정보 없음)");
      } catch (error) {
        console.error("❌ 게시 실패:", error.message);
      }
    }
  } catch (error) {
    console.error("❌ Instagram 테스트 중 오류 발생:", error);
  }
}

/**
 * Thread API 기능 테스트
 */
async function testThread() {
  console.log("\n===== Thread API 테스트 =====");

  try {
    if (!process.env.THREAD_ACCESS_TOKEN || !process.env.THREAD_USER_ID) {
      console.error(
        "❌ THREAD_ACCESS_TOKEN 또는 THREAD_USER_ID가 설정되지 않았습니다."
      );
      console.error("   .env 파일에 다음 환경 변수를 설정해주세요:");
      console.error("   THREAD_ACCESS_TOKEN=your_access_token_here");
      console.error("   THREAD_USER_ID=your_thread_user_id");
      return;
    }

    // Thread 서비스 인스턴스 생성
    const threadService = new ThreadService({
      accessToken: process.env.THREAD_ACCESS_TOKEN,
      platformUserId: process.env.THREAD_USER_ID,
    });

    // 1. 토큰 정보 확인
    if (TEST_MODE.CHECK_TOKEN) {
      console.log("📝 Thread 액세스 토큰 정보 확인 중...");
      try {
        const tokenInfo = await threadService.checkAccessToken();
        console.log("✅ 토큰 정보 확인 완료");
        console.log("   - 앱 ID:", tokenInfo.app_id);
        if (tokenInfo.expires_at) {
          const expiryDate = new Date(tokenInfo.expires_at * 1000);
          console.log("   - 만료일:", expiryDate.toLocaleString());

          // 만료 임박 경고
          const now = new Date();
          const daysLeft = Math.round(
            (expiryDate - now) / (1000 * 60 * 60 * 24)
          );
          if (daysLeft < 7) {
            console.warn(`⚠️ 주의: 토큰이 ${daysLeft}일 후에 만료됩니다!`);
          }
        } else {
          console.log("   - 만료일: 영구 토큰");
        }
        console.log(
          "   - 권한:",
          tokenInfo.scopes ? tokenInfo.scopes.join(", ") : "권한 정보 없음"
        );
      } catch (error) {
        console.error("❌ 토큰 정보 확인 실패:", error.message);
      }
    }

    // 2. 스레드 목록 조회
    if (TEST_MODE.LIST_MEDIA) {
      console.log("\n📝 Thread 목록 조회 중...");
      try {
        const threads = await threadService.getUserThreads(5);
        console.log(`✅ ${threads.length}개 스레드 항목 조회 완료`);

        if (threads.length > 0) {
          console.log("\n📊 스레드 항목 요약:");
          threads.forEach((thread, index) => {
            console.log(`   ${index + 1}. ID: ${thread.id}`);
            console.log(`      유형: ${thread.media_type || "TEXT"}`);
            if (thread.permalink) console.log(`      URL: ${thread.permalink}`);
            if (thread.timestamp)
              console.log(
                `      게시일: ${new Date(thread.timestamp).toLocaleString()}`
              );
            console.log(
              `      내용: ${
                thread.text
                  ? thread.text.substring(0, 50) + "..."
                  : "(내용 없음)"
              }`
            );
            console.log("");
          });
        }
      } catch (error) {
        console.error("❌ 스레드 목록 조회 실패:", error.message);
      }
    }

    // 3. 통계 정보 조회
    if (TEST_MODE.FETCH_STATISTICS) {
      console.log("\n📝 Thread 통계 정보 조회 중...");
      try {
        const stats = await threadService.getStatistics();
        console.log("✅ 통계 정보 조회 완료");
        console.log("   - 총 스레드 수:", stats.total_threads);

        if (stats.post_types) {
          console.log("   - 게시물 유형:");
          Object.entries(stats.post_types).forEach(([type, count]) => {
            console.log(`     · ${type}: ${count}개`);
          });
        }

        if (stats.engagement) {
          console.log("   - 인게이지먼트:");
          Object.entries(stats.engagement).forEach(([type, count]) => {
            console.log(`     · ${type}: ${count}`);
          });
        }

        if (stats.followers_count) {
          console.log("   - 팔로워 수:", stats.followers_count);
        }
      } catch (error) {
        console.error("❌ 통계 정보 조회 실패:", error.message);
      }
    }

    // 4. 스레드 게시 테스트 (실제 게시 주의!)
    if (TEST_MODE.PUBLISH_POST) {
      console.log(
        "\n⚠️ Thread 게시 테스트를 시작합니다. 실제 계정에 게시됩니다!"
      );
      console.log("   5초 내에 Ctrl+C를 눌러 취소할 수 있습니다...");

      await new Promise((resolve) => setTimeout(resolve, 5000));

      try {
        const text =
          "테스트 스레드입니다. 자동화된 테스트에 의해 생성되었습니다. #테스트 #개발";

        console.log("📝 Thread에 게시 중...");
        const result = await threadService.publish(text);

        console.log("✅ 게시 완료!");
        console.log("   - 스레드 ID:", result.id);
        console.log("   - 생성 ID:", result.creation_id);
        if (result.permalink) console.log("   - 스레드 URL:", result.permalink);
      } catch (error) {
        console.error("❌ 게시 실패:", error.message);
      }
    }
  } catch (error) {
    console.error("❌ Thread 테스트 중 오류 발생:", error);
  }
}

/**
 * SocialMediaService 테스트 (DB 필요)
 */
async function testSocialMediaService() {
  if (TEST_MODE.USE_MOCK_DATA) {
    console.log(
      "\n⚠️ USE_MOCK_DATA가 true이므로 SocialMediaService 테스트를 건너뜁니다."
    );
    console.log(
      "   실제 DB를 사용하려면 TEST_MODE.USE_MOCK_DATA = false로 설정하세요."
    );
    return;
  }

  console.log("\n===== SocialMediaService 테스트 =====");

  try {
    // 1. 계정 연결 테스트
    console.log("📝 Instagram 계정 연결 테스트...");
    const instagramAccount = await SocialMediaService.connectAccount(
      TEST_USER_ID,
      "instagram",
      {
        accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
        platformUserId: process.env.INSTAGRAM_USER_ID,
        username: "test_instagram_user",
      }
    );
    console.log("✅ Instagram 계정 연결 완료:", instagramAccount.platform);

    console.log("📝 Thread 계정 연결 테스트...");
    const threadAccount = await SocialMediaService.connectAccount(
      TEST_USER_ID,
      "thread",
      {
        accessToken: process.env.THREAD_ACCESS_TOKEN,
        platformUserId: process.env.THREAD_USER_ID,
        username: "test_thread_user",
      }
    );
    console.log("✅ Thread 계정 연결 완료:", threadAccount.platform);

    // 2. 연결된 계정 조회 테스트
    console.log("\n📝 연결된 계정 목록 조회...");
    const accounts = await SocialMediaService.getConnectedAccounts(
      TEST_USER_ID
    );
    console.log(`✅ ${accounts.length}개 계정 조회 완료:`);
    accounts.forEach((account) => {
      console.log(
        `   - 플랫폼: ${account.platform}, 사용자명: ${account.username}`
      );
    });

    // 3. 게시물 생성 테스트
    if (TEST_MODE.GENERATE_POST) {
      console.log("\n📝 Instagram 게시물 생성 테스트...");
      const instagramPost = await SocialMediaService.generateSocialPost(
        TEST_USER_ID,
        "test_article_123",
        "instagram",
        "이것은 테스트 기사입니다. 소셜 미디어 게시물 생성 기능을 테스트하기 위한 내용입니다.",
        { imageUrl: "https://via.placeholder.com/1080x1080.png?text=Test+Post" }
      );
      console.log("✅ Instagram 게시물 생성 완료:", instagramPost._id);

      console.log("\n📝 Thread 게시물 생성 테스트...");
      const threadPost = await SocialMediaService.generateSocialPost(
        TEST_USER_ID,
        "test_article_123",
        "thread",
        "이것은 테스트 기사입니다. 소셜 미디어 게시물 생성 기능을 테스트하기 위한 내용입니다."
      );
      console.log("✅ Thread 게시물 생성 완료:", threadPost._id);

      // 4. 게시물 목록 조회 테스트
      console.log("\n📝 게시물 목록 조회...");
      const posts = await SocialMediaService.getUserPosts(TEST_USER_ID);
      console.log(`✅ ${posts.length}개 게시물 조회 완료:`);
      posts.forEach((post) => {
        console.log(
          `   - 플랫폼: ${post.platform}, 상태: ${post.status}, ID: ${post._id}`
        );
      });

      // 5. 게시물 게시 테스트 (실제 게시 주의!)
      if (TEST_MODE.PUBLISH_POST) {
        console.log(
          "\n⚠️ 게시물 게시 테스트를 시작합니다. 실제 소셜 미디어에 게시됩니다!"
        );
        console.log("   5초 내에 Ctrl+C를 눌러 취소할 수 있습니다...");

        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Instagram 게시
        console.log("\n📝 Instagram 게시물 게시 중...");
        try {
          const publishedInstagram = await SocialMediaService.publishPost(
            TEST_USER_ID,
            instagramPost._id
          );
          console.log("✅ Instagram 게시 완료!");
          console.log("   - 상태:", publishedInstagram.status);
          console.log("   - 게시 시간:", publishedInstagram.publishedAt);
          console.log(
            "   - 플랫폼 게시물 ID:",
            publishedInstagram.platformPostId
          );
        } catch (error) {
          console.error("❌ Instagram 게시 실패:", error.message);
        }

        // Thread 게시
        console.log("\n📝 Thread 게시물 게시 중...");
        try {
          const publishedThread = await SocialMediaService.publishPost(
            TEST_USER_ID,
            threadPost._id
          );
          console.log("✅ Thread 게시 완료!");
          console.log("   - 상태:", publishedThread.status);
          console.log("   - 게시 시간:", publishedThread.publishedAt);
          console.log("   - 플랫폼 게시물 ID:", publishedThread.platformPostId);
        } catch (error) {
          console.error("❌ Thread 게시 실패:", error.message);
        }
      }
    }

    // 6. 통계 조회 테스트
    if (TEST_MODE.FETCH_STATISTICS) {
      console.log("\n📝 소셜 미디어 통계 조회 중...");
      try {
        const stats = await SocialMediaService.getSocialStatistics(
          TEST_USER_ID
        );
        console.log("✅ 통계 조회 완료!");

        if (stats.instagram) {
          console.log("\n📊 Instagram 통계:");
          console.log("   - 총 게시물 수:", stats.instagram.total_posts);
          // 기타 통계 정보 출력...
        }

        if (stats.thread) {
          console.log("\n📊 Thread 통계:");
          console.log("   - 총 스레드 수:", stats.thread.total_threads);
          // 기타 통계 정보 출력...
        }
      } catch (error) {
        console.error("❌ 통계 조회 실패:", error.message);
      }
    }
  } catch (error) {
    console.error("❌ SocialMediaService 테스트 중 오류 발생:", error);
  }
}

/**
 * 메인 테스트 함수
 */
async function runTests() {
  console.log("===== 소셜 미디어 기능 테스트 시작 =====");

  try {
    // DB 연결 (필요시)
    await connectDB();

    // Instagram API 테스트
    await testInstagram();

    // Thread API 테스트
    await testThread();

    // 소셜 미디어 서비스 테스트 (DB 필요)
    await testSocialMediaService();

    console.log("\n===== 소셜 미디어 기능 테스트 완료 =====");
  } catch (error) {
    console.error("테스트 실행 중 오류 발생:", error);
  } finally {
    // MongoDB 연결 종료 (필요시)
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("MongoDB 연결 종료");
    }
  }
}

// 테스트 실행
runTests();
